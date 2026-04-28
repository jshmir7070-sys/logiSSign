import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { logRateLimitHit } from "@/lib/security-logger";
import { logStructured } from "@/lib/request-context";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
let cleanupTimerInitialized = false;

type RateLimitRpcRow = {
  allowed: boolean;
  current_count: number;
  reset_at: string;
};

// Upstash REST 응답: pipeline 호출 시 [{result: ...}, ...] 형태
type UpstashPipelineResult = { result?: unknown; error?: unknown }[];

function initializeCleanupTimer() {
  if (cleanupTimerInitialized) return;
  cleanupTimerInitialized = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of Array.from(memoryStore.entries())) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function buildRateLimitResponse(
  currentCount: number,
  options: RateLimitOptions,
  resetAt: number
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return NextResponse.json(
    { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(options.maxRequests),
        "X-RateLimit-Remaining": String(Math.max(0, options.maxRequests - currentCount)),
        "X-RateLimit-Reset": String(resetAt),
      },
    }
  );
}

function checkMemoryRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions
): NextResponse | null {
  initializeCleanupTimer();

  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  entry.count += 1;

  if (entry.count > options.maxRequests) {
    void logRateLimitHit(ip, endpoint);
    return buildRateLimitResponse(entry.count, options, entry.resetAt);
  }

  return null;
}

function canUseUpstashRateLimit(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN &&
      process.env.RATE_LIMIT_BACKEND !== "memory" &&
      process.env.RATE_LIMIT_BACKEND !== "database"
  );
}

function canUseDatabaseRateLimit(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RATE_LIMIT_BACKEND !== "memory"
  );
}

async function checkUpstashRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  // 시간-버킷팅: 윈도우 경계마다 새 키를 사용해 카운트가 자연스럽게 리셋됨
  const now = Date.now();
  const bucketId = Math.floor(now / options.windowMs);
  const resetAt = (bucketId + 1) * options.windowMs;
  const key = `ratelimit:${ip}:${endpoint}:${bucketId}`;

  // INCR + PEXPIRE를 단일 round-trip pipeline으로 — Upstash REST가 순서대로 실행 보장
  // PEXPIRE는 windowMs * 2로 설정해서 윈도우가 끝난 뒤에도 잠시 살아있다가 자동 만료
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, options.windowMs * 2],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash HTTP ${response.status}`);
    }

    const payload = (await response.json()) as UpstashPipelineResult;
    const incrResult = Array.isArray(payload) ? payload[0] : null;
    if (!incrResult || incrResult.error) {
      throw new Error(`Upstash INCR error: ${String(incrResult?.error ?? "unknown")}`);
    }

    const count = Number(incrResult.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("Upstash INCR returned invalid count");
    }

    if (count > options.maxRequests) {
      void logRateLimitHit(ip, endpoint);
      return buildRateLimitResponse(count, options, resetAt);
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkDatabaseRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const supabase = createAdminSupabaseClient();
  const counterKey = `${ip}:${endpoint}`;

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_counter_key: counterKey,
    p_max_requests: options.maxRequests,
    p_window_ms: options.windowMs,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as RateLimitRpcRow | undefined) : undefined;
  if (!row) {
    throw new Error("Rate limit RPC returned no rows");
  }

  if (row.allowed) {
    return null;
  }

  const resetAt = new Date(row.reset_at).getTime();
  void logRateLimitHit(ip, endpoint);
  return buildRateLimitResponse(row.current_count, options, resetAt);
}

export async function checkRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions = { maxRequests: 30, windowMs: 60_000 }
): Promise<NextResponse | null> {
  // 우선순위: Upstash Redis (빠름, 멀티 인스턴스 안전) → Supabase RPC (느리지만 멀티 인스턴스 안전) → 메모리 (단일 인스턴스 한정)
  if (canUseUpstashRateLimit()) {
    try {
      return await checkUpstashRateLimit(ip, endpoint, options);
    } catch (error) {
      logStructured("warn", "rate_limit_upstash_fallback", {
        endpoint,
        ip,
        message: error instanceof Error ? error.message : String(error),
      });
      // Upstash 실패 시 DB 또는 메모리로 폴백
    }
  }

  if (!canUseDatabaseRateLimit()) {
    return checkMemoryRateLimit(ip, endpoint, options);
  }

  try {
    return await checkDatabaseRateLimit(ip, endpoint, options);
  } catch (error) {
    logStructured("warn", "rate_limit_backend_fallback", {
      endpoint,
      ip,
      message: error instanceof Error ? error.message : String(error),
    });

    return checkMemoryRateLimit(ip, endpoint, options);
  }
}

export async function rateLimitPublic(ip: string, endpoint: string) {
  return checkRateLimit(ip, endpoint, { maxRequests: 10, windowMs: 60_000 });
}

export async function rateLimitAuth(ip: string, endpoint: string) {
  return checkRateLimit(ip, endpoint, { maxRequests: 60, windowMs: 60_000 });
}

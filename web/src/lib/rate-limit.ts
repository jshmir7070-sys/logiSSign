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

function canUseDatabaseRateLimit(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RATE_LIMIT_BACKEND !== "memory"
  );
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

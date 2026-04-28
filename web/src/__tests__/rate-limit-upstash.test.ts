/**
 * Upstash Redis rate-limit 우선순위 동작 테스트.
 *
 * 1. 환경변수가 설정되면 Upstash REST 호출이 일어나고 그 결과로 429 여부 결정.
 * 2. Upstash가 던지면(타임아웃/HTTP 5xx) DB/메모리 폴백으로 자동 전환되어야
 *    응답이 막히지 않는다.
 * 3. UPSTASH_REDIS_REST_URL + TOKEN 환경변수가 모두 있으면 실제 Upstash에 대고
 *    INCR 동작을 검증한다 (없으면 자동 skip).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

const ORIGINAL_FETCH = globalThis.fetch;

function buildPipelineResponse(count: number): Response {
  // Upstash REST /pipeline은 [{result: <int>}, {result: 1}] 형태로 응답
  return new Response(
    JSON.stringify([{ result: count }, { result: 1 }]),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("rate-limit Upstash tier (mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://stub.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "stub-token");
    vi.stubEnv("RATE_LIMIT_BACKEND", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it("환경변수 설정 시 Upstash REST에 pipeline 요청을 보낸다", async () => {
    const fetchSpy = vi.fn(async () => buildPipelineResponse(1));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await checkRateLimit("9.9.9.1", "/upstash-test-1", {
      maxRequests: 5,
      windowMs: 60_000,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://stub.upstash.io/pipeline");
    expect(init?.method).toBe("POST");

    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer stub-token");

    const body = JSON.parse(String(init?.body));
    expect(body).toHaveLength(2);
    expect(body[0][0]).toBe("INCR");
    expect(body[1][0]).toBe("PEXPIRE");
    // 윈도우 * 2로 설정해 윈도우 경과 후 자동 만료
    expect(body[1][2]).toBe(60_000 * 2);
    // 키에 ip + endpoint + 윈도우 버킷이 들어간다
    expect(body[0][1]).toContain("9.9.9.1");
    expect(body[0][1]).toContain("/upstash-test-1");
  });

  it("count가 한도를 넘기면 429와 정상 헤더를 돌려준다", async () => {
    globalThis.fetch = vi.fn(async () => buildPipelineResponse(11)) as unknown as typeof globalThis.fetch;

    const result = await checkRateLimit("9.9.9.2", "/upstash-test-2", {
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    expect(result?.headers.get("Retry-After")).toBeTruthy();
    expect(result?.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("count가 한도 이하면 null을 돌려준다", async () => {
    globalThis.fetch = vi.fn(async () => buildPipelineResponse(3)) as unknown as typeof globalThis.fetch;

    const result = await checkRateLimit("9.9.9.3", "/upstash-test-3", {
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result).toBeNull();
  });

  it("Upstash 5xx 응답은 메모리 폴백으로 떨어져 응답을 막지 않는다", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("upstream error", { status: 503 }),
    ) as unknown as typeof globalThis.fetch;

    // SUPABASE_* env 가 없으니 메모리로 폴백
    const result = await checkRateLimit("9.9.9.4", "/upstash-test-4", {
      maxRequests: 5,
      windowMs: 60_000,
    });

    // 폴백된 메모리 store에서 첫 요청은 통과
    expect(result).toBeNull();
  });

  it("fetch 자체가 throw 해도 메모리 폴백으로 통과한다", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof globalThis.fetch;

    const result = await checkRateLimit("9.9.9.5", "/upstash-test-5", {
      maxRequests: 5,
      windowMs: 60_000,
    });

    expect(result).toBeNull();
  });

  it("RATE_LIMIT_BACKEND=memory면 Upstash를 호출하지 않는다", async () => {
    vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
    const fetchSpy = vi.fn(async () => buildPipelineResponse(1));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await checkRateLimit("9.9.9.6", "/upstash-test-6", {
      maxRequests: 5,
      windowMs: 60_000,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("윈도우 경계가 바뀌면 키도 바뀐다", async () => {
    const fetchSpy = vi.fn(async () => buildPipelineResponse(1));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    // 윈도우 5초로 충분히 짧게
    const realDateNow = Date.now;
    let now = 1_700_000_000_000;
    Date.now = () => now;

    try {
      await checkRateLimit("9.9.9.7", "/upstash-test-7", {
        maxRequests: 5,
        windowMs: 5_000,
      });
      now += 6_000; // 다음 윈도우로 점프
      await checkRateLimit("9.9.9.7", "/upstash-test-7", {
        maxRequests: 5,
        windowMs: 5_000,
      });

      const firstKey = JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1]?.body))[0][1] as string;
      const secondKey = JSON.parse(String((fetchSpy.mock.calls[1] as [string, RequestInit])[1]?.body))[0][1] as string;
      expect(firstKey).not.toBe(secondKey);
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe.skipIf(
  !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN,
)("rate-limit Upstash tier (real)", () => {
  it("실제 Upstash에 대고 INCR이 동작한다", async () => {
    const ip = `int-${Math.random().toString(36).slice(2, 10)}`;
    const endpoint = `/integration-test-${Date.now()}`;

    // 첫 요청 — 통과
    const first = await checkRateLimit(ip, endpoint, {
      maxRequests: 2,
      windowMs: 30_000,
    });
    expect(first).toBeNull();

    // 두 번째 — 통과
    const second = await checkRateLimit(ip, endpoint, {
      maxRequests: 2,
      windowMs: 30_000,
    });
    expect(second).toBeNull();

    // 세 번째 — 429
    const third = await checkRateLimit(ip, endpoint, {
      maxRequests: 2,
      windowMs: 30_000,
    });
    expect(third).not.toBeNull();
    expect(third?.status).toBe(429);
  });
});

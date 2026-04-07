import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitAuth, rateLimitPublic } from "@/lib/rate-limit";

describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    it("첫 요청은 통과한다", async () => {
      const result = await checkRateLimit("1.1.1.1", "/test-1", {
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result).toBeNull();
    });

    it("허용 횟수 내 요청은 통과한다", async () => {
      const ip = "2.2.2.2";
      const endpoint = "/test-2";

      for (let i = 0; i < 5; i += 1) {
        const result = await checkRateLimit(ip, endpoint, {
          maxRequests: 5,
          windowMs: 60_000,
        });
        expect(result).toBeNull();
      }
    });

    it("한도를 넘기면 429를 반환한다", async () => {
      const ip = "3.3.3.3";
      const endpoint = "/test-3";

      for (let i = 0; i < 5; i += 1) {
        await checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60_000 });
      }

      const result = await checkRateLimit(ip, endpoint, {
        maxRequests: 5,
        windowMs: 60_000,
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it("서로 다른 IP는 독립적으로 카운트한다", async () => {
      const endpoint = "/test-4";

      for (let i = 0; i < 5; i += 1) {
        await checkRateLimit("4.4.4.1", endpoint, { maxRequests: 5, windowMs: 60_000 });
      }

      const result = await checkRateLimit("4.4.4.2", endpoint, {
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result).toBeNull();
    });

    it("서로 다른 endpoint는 독립적으로 카운트한다", async () => {
      const ip = "5.5.5.5";

      for (let i = 0; i < 5; i += 1) {
        await checkRateLimit(ip, "/test-5a", { maxRequests: 5, windowMs: 60_000 });
      }

      const result = await checkRateLimit(ip, "/test-5b", {
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result).toBeNull();
    });

    it("429 응답에는 rate limit 헤더가 포함된다", async () => {
      const ip = "6.6.6.6";
      const endpoint = "/test-6";

      for (let i = 0; i < 5; i += 1) {
        await checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60_000 });
      }

      const result = await checkRateLimit(ip, endpoint, {
        maxRequests: 5,
        windowMs: 60_000,
      });

      expect(result).not.toBeNull();
      expect(result?.headers.get("Retry-After")).toBeTruthy();
      expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("rateLimitPublic", () => {
    it("분당 10회 제한을 적용한다", async () => {
      const ip = "7.7.7.7";

      for (let i = 0; i < 10; i += 1) {
        await expect(rateLimitPublic(ip, "/public-test")).resolves.toBeNull();
      }

      await expect(rateLimitPublic(ip, "/public-test")).resolves.not.toBeNull();
    });
  });

  describe("rateLimitAuth", () => {
    it("분당 60회 제한을 적용한다", async () => {
      const ip = "8.8.8.8";

      for (let i = 0; i < 60; i += 1) {
        await expect(rateLimitAuth(ip, "/auth-test")).resolves.toBeNull();
      }

      await expect(rateLimitAuth(ip, "/auth-test")).resolves.not.toBeNull();
    });
  });
});

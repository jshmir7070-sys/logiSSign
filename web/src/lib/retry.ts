/**
 * 일시적 실패(네트워크 오류, 5xx 등)에 대한 지수 백오프 재시도 헬퍼.
 *
 * 사용 예:
 *   const result = await withRetry(() => fetch(url), { maxAttempts: 3 })
 *
 * 영구 실패(4xx, 잘못된 입력 등)는 callback에서 throw 하지 말고 결과로 반환해
 * 호출자가 retry 여부를 결정하도록 한다.
 */

export interface RetryOptions {
  /** 최대 시도 횟수 (첫 시도 포함). 기본 3. */
  maxAttempts?: number
  /** 첫 백오프 ms. 기본 200. 매 시도마다 ×factor 적용. */
  initialDelayMs?: number
  /** 백오프 배수. 기본 4 → 200, 800, 3200ms */
  factor?: number
  /** 결과를 보고 재시도할지 결정. true면 재시도. 기본: 에러를 throw하지 않은 경우 모두 성공 처리. */
  shouldRetry?: (result: unknown) => boolean
  /** 호출 식별 — 로그 태깅용 */
  tag?: string
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'tag'>> = {
  maxAttempts: 3,
  initialDelayMs: 200,
  factor: 4,
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 결과를 그대로 반환하되, shouldRetry가 true이거나 throw 발생 시 재시도. */
export async function withRetry<T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts, initialDelayMs, factor } = { ...DEFAULT_OPTIONS, ...options }
  const shouldRetry = options.shouldRetry

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await task(attempt)
      if (attempt < maxAttempts && shouldRetry?.(result)) {
        const wait = initialDelayMs * Math.pow(factor, attempt - 1)
        await delay(wait)
        continue
      }
      return result
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      const wait = initialDelayMs * Math.pow(factor, attempt - 1)
      await delay(wait)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`retry failed${options.tag ? ` (${options.tag})` : ''}`)
}

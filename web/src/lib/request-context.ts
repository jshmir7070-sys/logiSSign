import type { NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";
export const SESSION_ACTIVITY_COOKIE = "__logissign_activity";

const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MIN_SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|key|otp|session|bearer|credit|card|account|bank|birth|ssn|ci|di)/i;

export interface RequestLogContext {
  requestId: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  agencyId?: string;
  role?: string;
}

function isHeadersLike(value: unknown): value is Headers {
  return typeof value === "object" && value !== null && "get" in value;
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value !== "object") return value;

  const entries = Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return [key, "[REDACTED]"];
    }
    return [key, sanitizeValue(nestedValue)];
  });

  return Object.fromEntries(entries);
}

export function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getRequestId(
  source?: Headers | Pick<Request, "headers"> | Pick<NextRequest, "headers"> | null
): string {
  if (!source) return createRequestId();

  if (isHeadersLike(source)) {
    return source.get(REQUEST_ID_HEADER) ?? createRequestId();
  }

  return source.headers.get(REQUEST_ID_HEADER) ?? createRequestId();
}

export function createRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  if (!headers.get(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, createRequestId());
  }

  return headers;
}

export function getRequestLogContext(
  request: NextRequest,
  extras: Partial<RequestLogContext> = {}
): RequestLogContext {
  return {
    requestId: getRequestId(request),
    path: request.nextUrl.pathname,
    method: request.method,
    ip:
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown",
    userAgent: request.headers.get("user-agent") ?? "unknown",
    ...extras,
  };
}

export function logStructured(
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {}
): void {
  const sanitizedContext = sanitizeValue(context) as Record<string, unknown>;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizedContext,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  if (level === "debug") {
    console.debug(line);
    return;
  }

  console.info(line);
}

export function getSessionIdleTimeoutMs(): number {
  const raw = process.env.SESSION_IDLE_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : DEFAULT_SESSION_IDLE_TIMEOUT_MS;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SESSION_IDLE_TIMEOUT_MS;
  }

  return Math.min(
    MAX_SESSION_IDLE_TIMEOUT_MS,
    Math.max(MIN_SESSION_IDLE_TIMEOUT_MS, Math.floor(parsed))
  );
}

export function isSessionIdle(lastActivityValue?: string | null): boolean {
  if (!lastActivityValue) return false;

  const lastActivity = Number(lastActivityValue);
  if (!Number.isFinite(lastActivity)) return false;

  return Date.now() - lastActivity > getSessionIdleTimeoutMs();
}

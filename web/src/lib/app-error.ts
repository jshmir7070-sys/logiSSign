export type AppErrorCode =
  | "internal_error"
  | "validation_error"
  | "authentication_required"
  | "permission_denied"
  | "rate_limited"
  | "service_unavailable"
  | "not_found"
  | "conflict"
  | "session_timeout"
  | "external_service_error";

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly expose: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: AppErrorCode;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.status = options.status ?? 500;
    this.code = options.code ?? "internal_error";
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;

    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      status: 400,
      code: "validation_error",
      expose: true,
      details,
    });
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "인증이 필요합니다", details?: Record<string, unknown>) {
    super(message, {
      status: 401,
      code: "authentication_required",
      expose: true,
      details,
    });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "권한이 없습니다", details?: Record<string, unknown>) {
    super(message, {
      status: 403,
      code: "permission_denied",
      expose: true,
      details,
    });
    this.name = "AuthorizationError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "요청이 너무 많습니다", details?: Record<string, unknown>) {
    super(message, {
      status: 429,
      code: "rate_limited",
      expose: true,
      details,
    });
    this.name = "RateLimitError";
  }
}

export class SessionTimeoutError extends AppError {
  constructor(message = "세션이 만료되었습니다", details?: Record<string, unknown>) {
    super(message, {
      status: 401,
      code: "session_timeout",
      expose: true,
      details,
    });
    this.name = "SessionTimeoutError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/app-error";
import { REQUEST_ID_HEADER, getRequestId, logStructured } from "@/lib/request-context";

type RequestLike = Headers | Pick<Request, "headers"> | null | undefined;

function resolveRequestId(source?: RequestLike): string {
  if (!source) return getRequestId();
  if (source instanceof Headers) return getRequestId(source);
  return getRequestId(source);
}

export function apiError(
  err: unknown,
  status = 500,
  fallbackMessage = "서버 오류가 발생했습니다",
  requestOrHeaders?: RequestLike
): NextResponse {
  const requestId = resolveRequestId(requestOrHeaders);
  const appError = isAppError(err) ? err : null;
  const effectiveStatus = appError?.status ?? status;

  const publicMessage =
    appError?.expose === true
      ? appError.message
      : process.env.NODE_ENV === "development"
        ? err instanceof Error
          ? err.message
          : String(err)
        : fallbackMessage;

  logStructured("error", "api_error", {
    requestId,
    status: effectiveStatus,
    code: appError?.code ?? "internal_error",
    message: err instanceof Error ? err.message : String(err),
    details: appError?.details,
  });

  const response = NextResponse.json(
    {
      error: publicMessage,
      code: appError?.code ?? "internal_error",
      requestId,
    },
    { status: effectiveStatus }
  );

  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function jsonError(
  message: string,
  options: {
    status?: number;
    code?: AppError["code"];
    requestOrHeaders?: RequestLike;
    details?: Record<string, unknown>;
  } = {}
): NextResponse {
  return apiError(
    new AppError(message, {
      status: options.status,
      code: options.code,
      expose: true,
      details: options.details,
    }),
    options.status,
    message,
    options.requestOrHeaders
  );
}

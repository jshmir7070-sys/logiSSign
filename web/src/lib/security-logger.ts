import { createAdminSupabaseClient } from "@/lib/supabase";
import { logStructured } from "@/lib/request-context";

export type SecurityEventType =
  | "auth_failure"
  | "auth_success"
  | "permission_denied"
  | "cron_access"
  | "data_modification"
  | "pii_access"
  | "rate_limit_hit"
  | "integrity_failure"
  | "suspicious_activity";

interface SecurityLogEntry {
  event_type: SecurityEventType;
  actor_id?: string;
  actor_ip?: string;
  actor_user_agent?: string;
  resource?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

export async function logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase.from("security_logs").insert({
      event_type: entry.event_type,
      actor_id: entry.actor_id ?? null,
      actor_ip: entry.actor_ip ?? null,
      actor_user_agent: entry.actor_user_agent ?? null,
      resource: entry.resource ?? null,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? {},
      severity: entry.severity,
    });
  } catch (error) {
    logStructured("error", "security_log_write_failed", {
      eventType: entry.event_type,
      resource: entry.resource,
      resourceId: entry.resource_id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function logAuthFailure(ip: string, endpoint: string, reason: string) {
  return logSecurityEvent({
    event_type: "auth_failure",
    actor_ip: ip,
    resource: endpoint,
    details: { reason },
    severity: "warning",
  });
}

export function logPermissionDenied(userId: string, ip: string, endpoint: string) {
  return logSecurityEvent({
    event_type: "permission_denied",
    actor_id: userId,
    actor_ip: ip,
    resource: endpoint,
    severity: "warning",
  });
}

export function logRateLimitHit(ip: string, endpoint: string) {
  return logSecurityEvent({
    event_type: "rate_limit_hit",
    actor_ip: ip,
    resource: endpoint,
    severity: "warning",
  });
}

export function logIntegrityFailure(contractId: string, reasons: string[]) {
  return logSecurityEvent({
    event_type: "integrity_failure",
    resource: "contracts",
    resource_id: contractId,
    details: { reasons },
    severity: "critical",
  });
}

export function logPiiAccess(opts: {
  actorId: string;
  actorIp?: string;
  resource: string;
  resourceId: string;
  fields: string[];
  action: "read" | "update";
}) {
  return logSecurityEvent({
    event_type: "pii_access",
    actor_id: opts.actorId,
    actor_ip: opts.actorIp,
    resource: opts.resource,
    resource_id: opts.resourceId,
    details: { fields: opts.fields, action: opts.action },
    severity: "info",
  });
}

export function logDataModification(opts: {
  actorId: string;
  actorIp?: string;
  resource: string;
  resourceId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
}) {
  return logSecurityEvent({
    event_type: "data_modification",
    actor_id: opts.actorId,
    actor_ip: opts.actorIp,
    resource: opts.resource,
    resource_id: opts.resourceId,
    details: { changes: opts.changes },
    severity: "warning",
  });
}

# logiSSign Security Policy

Version: 2.1  
Effective date: 2026-04-07

## 1. Purpose

This document defines the minimum security controls required to protect personal data, operational data, and platform integrity in logiSSign.

## 2. Scope

- User web portal
- Admin console
- Driver mobile app
- Supabase database and storage
- Integrated services such as PortOne, Solapi, Resend, OpenAI, and Sentry

## 3. Security principles

1. Apply least privilege by default
2. Separate provider, agency, and driver permissions
3. Encrypt sensitive data at rest where applicable
4. Keep auditable logs for sensitive operations
5. Protect public-facing flows with validation and rate limiting

## 4. Authentication and authorization

### 4.1 Roles

- `provider_admin`: platform operator
- `agency_admin`: agency operator
- `driver`: driver user

### 4.2 Authentication

- Primary authentication: email and password
- Secondary authentication: MFA code where enabled
- Session controls:
  - HttpOnly cookies for web flows
  - separate MFA cookie
  - idle timeout enforcement

### 4.3 Data access

- Row Level Security applies to core business tables
- `service_role` access is restricted to server-side code only
- Agency and driver access paths are separated

## 5. Personal data protection

### 5.1 Sensitive fields

- bank account number
- phone number
- birth date
- other driver and agency profile data that may identify a person

### 5.2 Protection controls

- Sensitive fields use AES-GCM based encryption where supported by the service layer
- Browser responses return only the minimum required fields
- Raw secrets and sensitive values must not be written to application logs

### 5.3 Auditability

- PII access and update events are recorded in `security_logs`
- Important data changes are recorded as modification events

## 6. Application security controls

- CSRF protection for authenticated write flows
- CSP and security headers on web responses
- request ID propagation and structured error responses
- rate limiting on public and sensitive APIs

## 7. Secrets management

- Secrets are managed in environment variables and GitHub Secrets
- Only non-sensitive values may use `NEXT_PUBLIC_*`
- Secret rotation must be followed by workflow verification

## 8. Backup and recovery

- Database backup is automated through GitHub Actions
- Backup retention is 30 days
- Recovery steps are documented in [BACKUP_AND_RECOVERY.md](/C:/Users/jshmi/Downloads/logiSSign/docs/BACKUP_AND_RECOVERY.md)

## 9. Vulnerability management

- Dependency checks run through `security-audit.yml`
- Regular checks include:
  - monthly dependency audit review
  - monthly restore drill review
  - quarterly role and RLS review

## 10. Incident response

- Incident handling follows [incident-response-plan.md](/C:/Users/jshmi/Downloads/logiSSign/docs/incident-response-plan.md)

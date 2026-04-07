# logiSSign Incident Response Plan

Version: 2.1  
Effective date: 2026-04-07

## 1. Purpose

This document defines how to detect, classify, contain, recover from, and document incidents such as data exposure, account compromise, service outage, and payment failure.

## 2. Detection channels

- Sentry for runtime errors and exceptions
- `security_logs` for auth failures, permission violations, PII access, and rate limit events
- `/api/health` for baseline service health
- GitHub Actions for dependency audit and backup workflow failures

## 3. Severity levels

### P1

- personal data exposure
- provider admin account compromise
- major service outage
- integrity issue in payment or settlement data

### P2

- partial outage of a core feature
- large spike in authentication or payment failures
- repeated failures in contract or settlement delivery

### P3

- limited feature degradation
- performance issue recoverable through operational action

## 4. Standard response flow

1. receive and triage the incident
2. estimate impact and affected scope
3. contain or isolate the issue
4. investigate the root cause
5. apply remediation or rollback
6. verify recovery
7. write the incident report and follow-up items

## 5. Immediate actions for P1

- disable or isolate affected access paths
- revoke or expire relevant sessions and tokens
- preserve logs and evidence
- review whether legal or regulatory notification is required

## 6. Recovery targets

- RPO: within 24 hours
- RTO: within 4 hours

## 7. Post-incident follow-up

- add prevention tasks for the same root cause
- add monitoring or tests if needed
- update operational documents and runbooks

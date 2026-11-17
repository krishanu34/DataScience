---
title: "Runbook: INC-48213 production storage upload failures"
---
# Runbook: INC-48213 production storage upload failures

Owner: Platform Storage team. On-call alias: `platform-storage-oncall`. Last reviewed: 2026-02-10.

## Summary

On 2026-02-03 all uploads to the production storage account `stcontosoprodeus2` (container `ingest-raw`) started failing with HTTP 403 and the error code `AuthorizationPermissionMismatch`. The incident is tracked as INC-48213 and the follow-up work as PLAT-2291.

## Root cause

The nightly job `cleanup-rbac-nightly` removed the "Storage Blob Data Contributor" role assignment from the managed identity `mi-ingest-prod`. The job treated the assignment as orphaned because the identity did not carry the tag `rbac-protected=true`.

## Resolution

1. Reassign the "Storage Blob Data Contributor" role to `mi-ingest-prod` at container scope on `ingest-raw`.
2. Add the tag `rbac-protected=true` to `mi-ingest-prod` so that `cleanup-rbac-nightly` skips it.
3. Re-run the failed ingest batch `batch-2026-02-03-b`. No data was lost.

## Prevention

Role assignments for production ingest identities are now managed in the Terraform module `tf-ingest-identity`. The job `cleanup-rbac-nightly` runs in report-only mode until PLAT-2291 is closed.

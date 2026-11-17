---
title: "Blob lifecycle policy v1 (deprecated)"
---
# Blob lifecycle policy v1 (DEPRECATED)

Status: deprecated, superseded by v2 on 2026-01-01. Do not use for new storage accounts.

## Rules

- Move blobs to the Cool tier 30 days after last modification.
- Delete blobs 90 days after last modification.
- The rules apply to all containers except those tagged `legal-hold=true`.

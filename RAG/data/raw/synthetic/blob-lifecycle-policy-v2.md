---
title: "Blob lifecycle policy v2 (current)"
---
# Blob lifecycle policy v2 (current)

Status: current, effective 2026-01-01. Replaces v1.

## Rules

- Move blobs to the Cool tier 14 days after last modification.
- Move blobs to the Archive tier 60 days after last modification.
- Delete blobs 365 days after last modification, to meet the one-year audit retention requirement.
- Containers tagged `legal-hold=true` are excluded from every rule.

## Why it changed

Policy v1 deleted data after 90 days, which was shorter than the audit retention period.

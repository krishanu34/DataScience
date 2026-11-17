---
title: "Break-glass access to production Key Vault kv-contoso-prod-001"
---
# Break-glass access to production Key Vault kv-contoso-prod-001

Classification: restricted. Audience: Security Administrators only.

## When to use

Use break-glass access only when the primary admin group `sg-kv-prod-admins` is unavailable during a Sev1 incident.

## Approval

Break-glass access requires two approvers from the Security Administrators group and a ticket of type `SEC-BREAKGLASS`. The reference example is ticket `SEC-9917`. Approvals are recorded in the ticket before access is issued.

## Access

The emergency account `bg-kv-admin` is enabled for a maximum of 4 hours. Its credentials are held in the sealed vault at the Amsterdam security office and are never sent by email or chat.

## After use

1. Disable `bg-kv-admin` immediately.
2. Rotate every secret that was read during the window and list them in the ticket.
3. Hold a review within 2 business days.

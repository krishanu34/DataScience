---
title: "Sev1 alert escalation matrix"
---
# Sev1 alert escalation matrix

Classification: restricted. Audience: Security Administrators and SRE leads.

## Escalation timeline

Alerts classified Sev1 page `pager-sre-l2` immediately. If the page is not acknowledged within 15 minutes, escalate to `pager-sre-l3`. After 30 minutes without mitigation, notify the VP Engineering through the bridge with code `ESC-5530`. Customer communication starts at 45 minutes and is owned by the incident commander.

## Contacts

The incident commander rota is published in the `ops-rota` calendar. Never share the bridge code outside the Sev1 channel.

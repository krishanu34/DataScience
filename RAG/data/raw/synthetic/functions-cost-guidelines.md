---
title: "Azure Functions cost guidelines"
---
# Azure Functions cost guidelines

Rule FIN-204: every function app must carry the tag `cost-center`.

## Choosing a plan

Use the Consumption plan for spiky workloads. Use Premium EP1 when cold-start latency must stay under 1 second or when virtual network integration is required.

## Budgets

A budget alert fires at 80% of the monthly budget. FinOps is paged at 100%.

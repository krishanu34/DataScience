---
title: "AKS cluster standards"
---
# AKS cluster standards

Policy ID: POL-AKS-017. Owner: Platform Engineering.

## Naming

Clusters are named `aks-<app>-<env>-<region>`, for example `aks-contoso-prod-weu`.

## Node pools

The system node pool uses `Standard_D4ds_v5` with a minimum of 3 nodes spread across availability zones. User node pools use the cluster autoscaler with a maximum of 20 nodes per pool.

## Versions

Clusters run at most one minor Kubernetes version behind the latest supported release (N-1). Upgrades happen in the window Tuesday 02:00-05:00 UTC.

## Networking

Clusters use Azure CNI Overlay with the pod CIDR `10.244.0.0/16`. Production clusters use a private API server endpoint.

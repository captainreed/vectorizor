#!/usr/bin/env bash
# One-time: install cert-manager (cluster-wide, in its own cert-manager namespace).
set -euo pipefail

VERSION="${CERT_MANAGER_VERSION:-v1.21.2}"
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${VERSION}/cert-manager.yaml"
kubectl -n cert-manager rollout status deployment/cert-manager --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=180s

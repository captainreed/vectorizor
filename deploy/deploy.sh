#!/usr/bin/env bash
# Build Vectorizor and (re)deploy it to the k3s cluster in the "personal" namespace.
#
#   ./deploy/deploy.sh
#
# Steps: build the image, import it into k3s's containerd (needs sudo), then apply the manifests
# and wait for the rollout. Safe to re-run; each run deploys the current working tree.
set -euo pipefail

cd "$(dirname "$0")/.."
NAMESPACE=personal
TAG="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo "-dirty-$(date +%s)")"
IMAGE="vectorizor:${TAG}"

echo "==> Building ${IMAGE}"
docker build -t "${IMAGE}" .

echo "==> Importing ${IMAGE} into k3s (sudo)"
docker save "${IMAGE}" | sudo k3s ctr images import -

echo "==> One-time cluster setup (no-ops once done)"
if ! kubectl get crd certificates.cert-manager.io >/dev/null 2>&1; then
  ./deploy/install-cert-manager.sh
fi
kubectl apply -f deploy/k8s/cluster-issuer.yaml

echo "==> Applying the app"
sed "s|vectorizor:IMAGE_TAG|${IMAGE}|" deploy/k8s/vectorizor.yaml | kubectl apply -f -

echo "==> DuckDNS updater"
kubectl -n "${NAMESPACE}" create configmap duckdns-script \
  --from-file=duckdns-update.sh=deploy/duckdns-update.sh --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/duckdns.yaml
if ! kubectl -n "${NAMESPACE}" get secret duckdns-token >/dev/null 2>&1; then
  echo "    NOTE: secret duckdns-token is missing, so the updater can't run yet. Create it with:"
  echo "      read -rsp 'DuckDNS token: ' T && kubectl -n ${NAMESPACE} create secret generic duckdns-token --from-literal=token=\"\$T\"; unset T"
fi

echo "==> Waiting for the rollout"
kubectl -n "${NAMESPACE}" rollout status deployment/vectorizor --timeout=180s

echo "==> Done: https://vectordemo.duckdns.org"
kubectl -n "${NAMESPACE}" get certificate vectordemo-tls 2>/dev/null || true

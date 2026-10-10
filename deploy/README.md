# Deploying Vectorizor

Runs on the home k3s cluster in the `personal` namespace at **https://vectordemo.duckdns.org**.

```
internet ─▶ router :80/:443 ─▶ 192.168.0.130 ─▶ Traefik ─▶ Service vectorizor ─▶ Pod (node, :3000)
                                                                                  └─ PVC vectorizor-data (SQLite at /data)
```

| File | What it is |
| --- | --- |
| `../Dockerfile` | Two-stage image: builds the client and the bundled server, runs `node dist-server/index.js` |
| `deploy.sh` | Build, import into k3s (sudo), apply everything, wait for the rollout |
| `k8s/vectorizor.yaml` | PVC, Deployment, Service, HTTPS redirect, Ingress with a Let's Encrypt certificate |
| `k8s/duckdns.yaml` + `duckdns-update.sh` | CronJob that keeps the DuckDNS name on the current public IP |
| `k8s/cluster-issuer.yaml` | Let's Encrypt issuers for cert-manager (cluster-wide) |
| `install-cert-manager.sh` | One-time cert-manager install (cluster-wide) |
| `k8s/coredns-custom.yaml` | In-cluster DNS for the site name (the router has no hairpin NAT) |

## Redeploy after changes

```bash
./deploy/deploy.sh
```

Each run builds the current working tree, tags the image with the git commit, and rolls it out.
Data in the PVC is kept. Importing the image into k3s's containerd needs `sudo`.

## One-time setup

1. **Router:** forward TCP 80 and 443 to `192.168.0.130`. Port 80 must be reachable from the
   internet for Let's Encrypt to issue and renew the certificate.
2. **DuckDNS token** (kept only in the cluster, never in git):
   ```bash
   read -rsp 'DuckDNS token: ' T && kubectl -n personal create secret generic duckdns-token --from-literal=token="$T"; unset T
   ```
3. `kubectl apply -f deploy/k8s/coredns-custom.yaml && kubectl -n kube-system rollout restart deployment/coredns`
4. `./deploy/deploy.sh` (installs cert-manager on first run if it's missing)

## Checking on things

```bash
kubectl -n personal get pods,ingress,certificate
kubectl -n personal logs deploy/vectorizor
kubectl -n personal logs job/$(kubectl -n personal get jobs -o name | grep duckdns | tail -1 | cut -d/ -f2)
kubectl -n personal create job --from=cronjob/duckdns-updater duckdns-now   # run the updater now
kubectl -n personal describe challenge   # why a certificate isn't issuing yet
```

If the certificate failed (e.g. port 80 wasn't reachable), cert-manager backs off for an hour.
To retry right away after fixing the cause: `kubectl -n personal delete certificate vectordemo-tls`
(the Ingress recreates it immediately). Let's Encrypt allows 5 failed validations per hour.

## Backups

The database is a single SQLite file on the `vectorizor-data` volume:

```bash
kubectl -n personal exec deploy/vectorizor -- node -e \
  "require('better-sqlite3')('/data/vectorizor.db').backup('/data/backup.db').then(()=>console.log('ok'))"
kubectl -n personal cp "$(kubectl -n personal get pod -l app=vectorizor -o name | cut -d/ -f2)":/data/backup.db ./vectorizor-backup.db
```

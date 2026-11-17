# Tencent Cloud deployment — private preview

Workflow: `.github/workflows/deploy-tencent.yml` (manual `workflow_dispatch` only; nothing deploys on push).
Target: `https://resurrection.quinnverse.tech` on the existing server `124.223.15.11`.

The workflow fails closed. It stops before changing the server if a secret is missing, the DNS record is wrong, the SSH host key is not pinned, or a read-only preflight finds a conflict.

## 1. Owner actions required (once)

### 1a. DNS record
Create this record in the DNS zone for `quinnverse.tech`:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `resurrection` | `124.223.15.11` | 600 |

Check it with `getent ahostsv4 resurrection.quinnverse.tech` before running the workflow.

### 1b. Repository secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `TENCENT_SSH_HOST` | `124.223.15.11` (or the host name used in the host key line) |
| `TENCENT_SSH_USER` | the deploy user on the server (not root if avoidable; it needs Docker and sudo rights for nginx and certbot) |
| `TENCENT_SSH_KEY` | the **private** key for that user, in OpenSSH format. Generate a dedicated key; do not reuse a personal key. |
| `TENCENT_SSH_HOST_KEY` | one `known_hosts` line for the server, from a trusted machine: `ssh-keyscan -t ed25519 124.223.15.11`. Verify the fingerprint out of band before storing it. |
| `TENCENT_CERT_EMAIL` | contact e-mail for the certificate authority |
| `RESURRECTION_PREVIEW_USER` | the preview user name, 3–32 characters: letters, digits, `_`, `.`, `-` |
| `RESURRECTION_PREVIEW_PASSWORD` | the preview password, at least 16 characters. Keep it in a password manager; it is not stored anywhere else. |

Secrets are read only inside the workflow. They are not written to logs or to Git, and the deploy script receives them on stdin, not as command arguments.

## 2. Running the deployment

1. Actions → **Deploy Resurrection (Tencent Cloud, private preview)** → Run workflow.
2. `release_sha`: `d168c072814d94e1698449565136678a470f9dfb` (the release candidate; must be on master).
3. `confirm`: `DEPLOY`.

The run goes through these stages, in order:
1. Guards: commit SHA, on master, confirmation text.
2. Secrets present (values never shown).
3. DNS resolves to `124.223.15.11`.
4. SSH host key pinned; server identity checked.
5. Read-only preflight on the server: Docker reachable, ≥800 MB memory free, ≥5 GB disk free, port 3100 free, host nginx owns 443 and includes `conf.d`, no existing route for the domain, certificate or certbot plus webroot available. Any conflict stops the run with no changes.
6. Deploy: builds the image on the server, runs one container on `127.0.0.1:3100` as uid 1000, health-checks it, writes the preview gate and an nginx site file, issues the certificate through the webroot, and reloads nginx (not restart).
7. Acceptance against the public HTTPS address: unauthenticated access blocked, authenticated game works, session progress.
8. Container restart, then the post-restart check (progress survives, deletion works).
9. Browser checks on the live address (Playwright, Chromium).
10. Comparison of existing containers before and after.

## 3. What the server gets

| Object | Name | Notes |
|---|---|---|
| Container | `resurrection` | label `quinnverse.app=resurrection`; `--restart unless-stopped`; read-only root; all capabilities dropped; 256 MB, 1 CPU |
| Save directory | `/var/lib/resurrection/saves` | owner uid 1000, mode 0700, outside the container |
| Releases | `/opt/resurrection/releases/<sha>` | build context only |
| Nginx site | `/etc/nginx/conf.d/resurrection.quinnverse.tech.conf` | the only nginx file added |
| Preview gate | `/etc/nginx/resurrection-preview.htpasswd` | apr1 hash, mode 0640 |
| Certificate | `/etc/letsencrypt/live/resurrection.quinnverse.tech/` | issued by certbot via webroot |

Nothing else is changed. No existing container, volume, network, nginx file or DNS record is modified.

## 4. Rollback

**Automatic:** if the deploy script fails, it restores the previous Resurrection container (if one existed) and removes its own site file. If acceptance fails after a successful deploy, the workflow runs `/tmp/resurrection-rollback.sh`, which does the same.

**Manual (Resurrection only):**
```bash
sudo bash /tmp/resurrection-rollback.sh     # or the copy under /opt/resurrection/releases/<sha>/deploy/tencent/rollback.sh
```
Remove Resurrection entirely (keeps saves unless you delete them too):
```bash
docker rm -f resurrection
sudo rm -f /etc/nginx/conf.d/resurrection.quinnverse.tech.conf /etc/nginx/resurrection-preview.htpasswd
sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /var/lib/resurrection     # DELETES ALL PREVIEW SAVES
```

## 5. Access for the owner

Open `https://resurrection.quinnverse.tech` in a browser. The browser asks for the preview user name and password. Those are the values stored in `RESURRECTION_PREVIEW_USER` and `RESURRECTION_PREVIEW_PASSWORD`; the owner already holds them. Do not share the URL beyond the playtesters.

## 6. Limits

- Single instance. Saves and rate limits are per process.
- Saves expire after seven days; cleanup runs at startup and every 24 hours.
- The Resurrection site writes no access log (`access_log off`). Its error log keeps only critical (`crit`) messages: nginx's ordinary error lines quote the full request line, which holds the session token. The game's own container logs contain no tokens (tested in CI). Other sites keep their own logging.

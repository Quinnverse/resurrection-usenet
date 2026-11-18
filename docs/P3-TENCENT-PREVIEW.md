# P3 腾讯云试玩部署说明

目标：在现有 `https://resurrection.quinnverse.tech/p3/` 试玩 P3.2 第一章《她十七岁的那个夏天》（Resurrection — The Internet Remembers You），旧版四幕游戏（`/`）、存档和 API 保持不变。

> 玩家的 P3.2 存档保存在浏览器本地（键 `p3.save.v2`）。早先 P3 原型的本地存档（`p3.save.v1`）不会被读取，也不会被删除。

本部署包只更新已经在运行的预览容器，不新建站点，不改 nginx，不依赖服务器访问 GitHub，不需要任何 GitHub Secrets。

## 前提（部署前请确认）

| 项 | 要求 |
|---|---|
| 容器 | 已存在名为 `resurrection-preview` 的容器，发布在 `127.0.0.1:18080` |
| 数据卷 | 已存在 Docker 卷 `resurrection_saves`，并挂载在该容器中 |
| 软件 | `docker`、`curl`（服务器已有 Docker 和 Nginx） |
| 基础镜像 | 构建时需要 `node:22-alpine`。服务器已有该镜像，或能访问 Docker Hub / 腾讯云镜像加速器 |
| nginx | `resurrection.quinnverse.tech` 把 **所有路径** 转发到 `127.0.0.1:18080`（见下方“nginx 检查”） |

任何一项不满足，脚本会在改动前停止并说明原因。

## 0. 先只读检查服务器（不改任何东西）

从 GitHub 分支下载 `deploy/p3-preview/inspect.sh`（https://github.com/Quinnverse/resurrection-usenet/blob/p3-life-in-fragments/deploy/p3-preview/inspect.sh ），在你的电脑上执行，**不需要先上传任何文件**：

```bash
ssh <user>@<server> 'bash -s' < inspect.sh          # 如果 docker 需要 sudo：ssh -t <user>@<server> 'sudo bash -s' < inspect.sh
```

它只读取并打印：当前容器的镜像/限制/端口/挂载（环境变量只打印名字，不打印值）、`resurrection_saves` 卷、已有镜像、18080/18081 端口、当前 `/`、`/p3/` 与 `/api/health` 的返回、nginx 是否把所有路径转发到 18080、本机经 nginx 访问 `/` 和 `/p3/` 的状态码，并给出 PASS/WARN/FAIL。它不会启动、停止、重命名容器，不会构建或拉取镜像，不会写文件，也不会重载 nginx。把完整输出贴回来，确认无 FAIL 后再继续。

## 不部署也能先玩（本机）

需要 Node 20 以上。解压 ZIP 后：

```bash
cd resurrection-p3-<sha7> && node combined-server/server.js     # 然后打开 http://127.0.0.1:3000/p3/
```

存档保存在浏览器本地，和服务器无关。

## 1. 上传

在你的电脑上（ZIP 从 GitHub 分支 `p3-life-in-fragments` 的 `release/` 目录下载）：

```bash
sha256sum resurrection-p3-<sha7>.zip          # 与 release/SHA256SUMS 和交付说明中的值比对
scp resurrection-p3-<sha7>.zip <user>@<server>:~/
```

## 2. 解压并先做只读验证

```bash
ssh <user>@<server>
sha256sum resurrection-p3-<sha7>.zip          # 再核对一次
unzip -q resurrection-p3-<sha7>.zip && cd resurrection-p3-<sha7>
bash deploy/p3-preview/deploy.sh --verify-only
```

`--verify-only` 会构建新镜像，并在 `127.0.0.1:18081` 启动一个临时候选容器（使用临时数据卷，**不挂载** `resurrection_saves`），检查后删除。运行中的游戏不受影响。检查项：

- `/api/health` 正常
- `/p3/`、`/p3`、`/p3/puzzle.js`、`/p3/game.js` 等 9 个脚本路由返回 P3.2 内容
- 旧版首页 `/` 与当前运行版本逐字节一致
- 会话 API 可创建并读回
- 容器以 `node` 用户运行、内存/CPU/进程数限制已生效、数据目录可写

## 3. 部署

```bash
bash deploy/p3-preview/deploy.sh
```

脚本依次执行：只读预检 → 构建 → 候选容器验证 → 把 `resurrection_saves` 以只读方式打包备份到 `~/.resurrection-p3-deploy/backups/` → 旧容器改名并停止（不删除）→ 用同一个卷启动新容器 → 健康检查与存档文件数核对。任何一步失败都会自动回滚。

默认限制：内存 256m、CPU 0.5、进程数 128，可用 `P3_MEMORY`、`P3_CPUS`、`P3_PIDS` 覆盖。如果 18081 被占用，设置 `P3_CANDIDATE_PORT`。

镜像标签：`resurrection:p3-<sha7>`（本次版本）、`resurrection:p3-latest`、`resurrection:rollback-<时间>`（旧镜像，指向部署前正在运行的镜像）。旧镜像和旧容器都保留。

如果 docker 需要 sudo：

```bash
sudo P3_STATE_DIR=/var/lib/resurrection-p3-deploy bash deploy/p3-preview/deploy.sh
```

回滚时也要带同一个 `P3_STATE_DIR`。

## 4. 试玩

浏览器打开 `https://resurrection.quinnverse.tech/p3/`，同时确认 `https://resurrection.quinnverse.tech/` 的旧版游戏正常。

## 回滚（一条命令）

```bash
bash ~/.resurrection-p3-deploy/rollback.sh
```

把新容器改名为 `resurrection-preview-failed-<时间>`（保留日志）并停止，把旧容器改回 `resurrection-preview` 并启动，然后检查健康。不删除任何东西，不修改 `resurrection_saves`。该文件在部署时被复制到状态目录，源码目录删除后仍可使用。

## nginx 检查（脚本不会修改 nginx）

```bash
curl -sI http://127.0.0.1:18080/p3/ | head -1      # 应为 HTTP/1.1 200
sudo nginx -T 2>/dev/null | grep -n -B3 -A6 18080  # 确认是 location / 整体转发
```

如果 nginx 只转发了固定路径（例如只写了 `location = /`、`location /api/`），`/p3/` 会 404。此时在该 server 块内增加下面一段，再 `sudo nginx -t && sudo systemctl reload nginx`（这是唯一需要你手动做的 nginx 改动，且仅在上面检查失败时需要）：

```nginx
location /p3/ { proxy_pass http://127.0.0.1:18080; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
```

## 脚本会碰什么、不会碰什么

| 会 | 不会 |
|---|---|
| 构建镜像 `resurrection:*` | 删除任何镜像、容器、卷 |
| 临时创建/删除 `resurrection-preview-candidate` | 修改 nginx 或其他站点、其他容器 |
| 以只读方式读取并备份 `resurrection_saves` | 写入或清理 `resurrection_saves` |
| 重命名并停止 `resurrection-preview`，启动同名新容器 | 访问 GitHub 或任何外部服务（除拉取基础镜像） |

## 已验证与未验证

- 已验证：部署脚本在模拟 Docker 层上，对真实的旧版（`d168c07`）与新版 Node 服务运行了完整流程：候选验证、备份、切换、存档跨版本可读、回滚、启动失败自动回滚、缺卷拒绝。缺少 `/p3` 路由的构建会被候选验证拒绝。运行方式：`bash test/p3-deploy-mock.sh <旧版源码目录>`。
- **未验证**：真实 Docker 构建与真实守护进程对运行参数的处理、腾讯云主机能否拉取 `node:22-alpine`、你的 nginx 是否转发 `/p3/`、真实服务器上的 sudo/权限情况。这些只能在你的服务器上通过 `--verify-only` 确认。

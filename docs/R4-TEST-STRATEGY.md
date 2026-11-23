# R4 — CI 与测试策略（审计、改动、预期、实测）

## 1. 审计：时间花在哪里了

数据来自 GitHub Actions 上同一分支最近的运行（`gh api .../actions/runs`），不是估计。

| 事实 | 数据 | 问题 |
|---|---|---|
| 一次完整运行 | 运行 `44987957801`（commit `40adaa4`）：**96 分钟**（05:06 → 06:42） | 反馈太慢 |
| 最长的单个任务 | `V5 full game` **96 分钟**：一个任务里串行跑 shell 套件、打包、**两个整局测试（EN、ZH，各 29–38 分钟）**、其余测试 | 真正的瓶颈；后面的任务都在等它 |
| 纯文档提交也跑了长任务 | 运行 `44994984431`（`f116e4f`，只加了 release 目录）：`V5 RC1/RC2/RC3 review pages` **38 分钟**仍然运行 | 该任务没有 `needs: changes`，每次 push 都跑 |
| 没有 concurrency | 运行 `44985849604`、`44797009323` 被人手取消，新提交到来时旧运行继续占用 runner | 过期运行不会被取消 |
| 最近 12 次运行 | **8 次失败**，每次都是整套（约 90 分钟）重跑 | 每次 push 都触发整套是主要的重复来源 |
| P5 任务 | **31 分钟，每次失败**（已知基线失败，旧代码，`V5-P5-BASELINE.md`） | 与 R4 无关，每次占 31 分钟 |
| 重复覆盖 | `npm run test:v5-shell`（含 `--bench`）在两个任务里各跑一遍；kbm 设备任务（38 分钟）在真实键盘通关，`whole game EN` 用注入输入通关——**这两个覆盖不同的东西**（真实设备事件 vs 页面与游戏逻辑）；保留 | |
| Chromium | 9 个任务各自 `playwright install --with-deps` | 每次重新下载 |
| 历史慢任务 | 设备任务 kbm 38 分钟、pad 15、touch 16；RC 页面 38；旧页面 18 | 可以并行 |

## 2. 改了什么

| 约束（Owner） | 改动 | 位置 |
|---|---|---|
| 1 日常只跑本地快速测试；不要每次 push 都触发完整 CI | push 默认只跑 `quick`（约 3 分钟）；完整套件只在 `[ci full]` 提交信息、手动 `workflow_dispatch suite=full`、或 pull request 时运行；`[ci r4]` 加跑真实 Chromium 的 R4 检查 | `test.yml` 的 `plan` 任务 |
| 2 按变更范围定向测试 | 本地：`npm run test:r4`（`tools/r4-affected.mjs`）把改动文件映射到最小测试集：序章文件→序章+尾声；光束文件→两个光束检查；`game.js` / `main.js` 等中心文件→Node + 外壳 + 全部 R4 浏览器检查 | `tools/r4-affected.mjs` |
| 3 文档/报告/剧本/截图/发布目录不得触发整局测试 | `push.paths-ignore`：`docs/**`、`release/**`、`**/*.md`、`test-runs/**` 根本不启动 workflow；本地 `r4-affected` 对这些文件输出“无需测试” | `test.yml`、`r4-affected.mjs` |
| 4 同一版本的完整结果可复用 | `plan` 计算**游戏文件指纹**（`tools/r4-fingerprint.sh`：`git ls-files -s` 对 frontend/combined-server/test/e2e/测试工具的哈希，排除 docs/release/打包脚本/截图）；完整套件通过后 `record` 任务把指纹存进 Actions 缓存；以后相同指纹的完整运行直接复用，并在日志里写出原运行号；`force` 选项可强制重跑 | `plan`、`record` |
| 5 全量仅在功能冻结后跑一次；失败只重跑受影响测试 | 由流程保证：冻结后一次 `[ci full]`；之后失败的任务可以在 Actions 上“Re-run failed jobs”（矩阵任务是独立的）；指纹未变时不会重复整套 | 流程 + 矩阵拆分 |
| 6 长测试并行、合理超时、取消过期运行 | `v5-main` 拆成 3 个并行任务（整局 EN / 整局 ZH / 其余）；设备矩阵 kbm/pad/touch 独立超时 65/45/45 分钟；RC 页面按文件拆成 2 个；R4 浏览器检查拆成 3 个；`concurrency` 取消同一分支上过期的 push 运行（手动运行与 push 运行互不取消） | `test.yml` |
| 7 检查触发条件、并发、缓存、重复覆盖、历史耗时 | 见上表（本节） | |
| 8 不要反复 push | 本地先验证，阶段性本地提交，最终集中推送；本轮在功能冻结前**没有 push 任何提交** | git 记录 |
| 9 超过 30 分钟的测试 | 完整整局测试 29–38 分钟，原因是**游戏是实时的**（每帧都画，虚拟时钟下 540 游戏秒 = 约 16200 帧在软件 GPU 上渲染）；更快的等效方法：本地 `npm run test:v5-shell`（同一份 `main.js`，Node 里不画图，约 1 分钟）和 R4 浏览器检查（约 7 分钟）覆盖同一状态机；但“真实 Chromium 从头到尾”没有等效替代，所以保留，并行，且只在冻结后一次 | |
| 10 不要为等 CI 阻塞别的工作 | 本轮用后台任务运行长测试，同时写文档与改代码 | 流程 |
| Chromium 缓存 | 复合 action `.github/actions/browser`：`npm ci`（带 npm 缓存）+ 以 Playwright 版本为键缓存 `~/.cache/ms-playwright`，命中时只装系统库 | `.github/actions/browser/action.yml` |
| P5 切片 | 仅当本分支（相对 master）改动了 P5 或 combined-server 时运行；**原因**：它是旧代码、已知基线失败，R4 没有碰它；每次省 31 分钟 runner。这不是降低标准：结果会在报告里写“P5 未改动，基线失败不变” | `plan.areas` |

## 3. 本地反馈（日常）

| 命令 | 做什么 | 耗时（本机实测） |
|---|---|---|
| `npm test` | 285 个 Node 测试（含 `v5-r4.test.mjs`：双语一致、选择只改措辞、信与第六章一致、光束收敛、对话停身体、旧存档、每个 beat 有目标和提示） | 约 10 秒 |
| `npm run test:r4:quick` | 上面 + Node 外壳整局（英文） | 约 1.5 分钟 |
| `npm run test:r4:plan` / `npm run test:r4` | 只打印 / 运行受影响的测试 | 按改动，1–12 分钟 |
| `node tools/r4-browser.mjs <检查名>` | 真实 Chromium、真实键盘：`prologue` `prologue-zh` `chase` `cameras` `beam` `town-beam` `chain` `epilogue` | 序章每种语言约 3 分钟；光束约 40 秒；相机扫描约 1 分钟；全部约 8 分钟（本地串行） |
| `node tools/r4-camera-scan.mjs [beat]` | 对话镜头逐个射线检查 | 每个 beat 约 10–15 秒 |

## 4. 预期与实测（实测来自运行 `45047974678`，commit `280e07a`，`[ci full]`）

| | 目标（Owner） | 实测 |
|---|---|---|
| 日常反馈 | 1–3 分钟 | **Quick 任务 1 分钟**（Plan 与容器烟测各不足 1 分钟）；本地 `npm test` 约 10 秒 |
| 定向浏览器验证 | 5–15 分钟 | R4 检查 3 个并行分片：EN 序章 7 分钟，ZH 序章 4 分钟（失败退出），其余 8 分钟（失败退出）；本地全部约 8 分钟 |
| 完整 CI | 60–90 分钟 | **54 分 46 秒**（RC3 的完整运行是 96 分钟）。关键路径：kbm 设备整局 54 分，整局 EN 49 分，整局 ZH 47 分；RC2 页面 38 分 |

各任务（分钟）：Quick 1 · Plan 0 · 容器 0 · 旧页面 18 · V5 其余 19 · RC 页面 6 / 38 · 整局 EN 49 · 整局 ZH 47 · 设备 kbm 54 / pad 18 / touch 12 · R4 检查 7 / 4 / 8 · P5 31。

### 这次运行里没有成功的部分

| 项 | 结果 | 原因 |
|---|---|---|
| P5 切片 | 失败，5 个失败 / 5 个通过 | **已知基线，与 `V5-P5-BASELINE.md` 记录的 3 次完全一致**，没有新回归。它被启动，是因为本分支相对 master 早先改过 `combined-server/server.js`（RC 阶段），这符合我写的规则，不是 Plan 出错。 |
| R4 检查：ZH 序章、尾声 | 失败 | **检查脚本的竞态**，见 `R4-REPORT.md` §4。已修复并在 CI 同等速度的条件下重跑通过，**没有在 GitHub 上重跑**。 |
| `record`（登记完整通过） | 跳过 | 推送上去的版本要求没有任何任务失败；P5 与两个 R4 检查失败，所以不登记。 |

### CI 配置里没有被实际验证的部分（必须说明）

1. **复用机制从未被执行过**：`record` 只有在全部通过后才会运行，而这次没有。所以“同一版本的完整结果被复用”这一条是**设计，不是已验证的行为**。指纹脚本本身验证过（改文档/打包脚本/截图指纹不变，改游戏文件指纹变）。
2. 我另外写了两项改动（`record` 不再被 P5 的基线失败拖住；`record_from` 手动登记一次已检查的运行），只做过本地 actionlint，**没有在 GitHub 上运行过**，所以**没有推送**，保存在本地分支 `backup/ci-record-from-unverified`。
3. 指纹包含 `tools/r4-browser.mjs`，所以修复检查脚本后指纹已变，旧运行不能再被登记。这是设计上正确的结果：测试定义变了，就应当重新测。

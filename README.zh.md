# QMS Testnet Runner — 中文

[English README](README.md) · [Türkçe](README.tr.md) · [GitHub](https://github.com/eCoxvague/qms-testnet-runner)

一条命令完成：部署合约、调用计数器、在 QWAP 上 swap、添加流动性，并校验区块的 QUBO 解的目标函数值。

基于 [QMS 官方入门指南](https://qms.finance/news/welcome-to-qms-testnet) 的社区工具，独立维护，非 QMS 或 QWAP 官方产品。

**终端输出为简体中文**（步骤日志、错误提示、密钥导入与 Streak 状态等；文案集中在 `scripts/messages.mjs`）。

## 10 月 19 日 Testnet Streak

专用「每日 1 次 swap + 1 次 LP」模式：按 UTC 日界、收据/事件校验、防重复发送、中断后可续跑，以及本地 6/7 天进度估算。复用当前钱包，不部署新合约。

```sh
npm run streak:prepare
npm run streak:status
npm run streak
```

七日活动：**2026 年 10 月 19 日 13:00 UTC** 开始，**10 月 26 日 13:00 UTC** 结束。开始前每日命令不会上链。含保守 gas 预留的默认每日预算约 **0.55 QMS**。

### 常驻自动运行（推荐）

完成 `npm run streak:prepare` 后，用**守护进程** 7×24 小时按间隔自动执行 Streak（默认 **每 24 小时** 检查；活动进行中才会上链，已完成当日会跳过）：

```sh
npm run streak:daemon
```

- **Linux/macOS 开机自启**：`npm run streak:daemon:install`（systemd 用户服务，崩溃自动重启）
- **停止服务**：`npm run streak:daemon:uninstall`
- **只跑一轮**：`npm run streak:daemon -- --once`
- **改间隔**：`npm run streak:daemon -- --interval-minutes 60`（最短 1 分钟，最长 1440 分钟即 24 小时）
- 日志：`reports/streak-daemon/`（含 `daemon.log` 与各次子进程输出）
- Linux/macOS 无人值守：可在 `.secrets/daemon.env` 中设置 `QMS_KEYSTORE_PASSWORD=...`（勿提交 Git）；Windows 使用 DPAPI 时通常不需要

活动结束（见 `config/streak.json`）后守护进程默认自动退出；间隔与行为可在 `config/daemon.json` 调整。

Windows 仍可使用计划任务：`npm run streak:install` / `npm run streak:uninstall`（需保持用户会话登录）。

Quanta 与角色资格仅为**本地估算**，非官方奖励核验。[完整 streak 说明与命令](docs/streak.md)。

## 快速开始

安装 **Node.js 22+** 与 Git，然后克隆：

```sh
git clone https://github.com/eCoxvague/qms-testnet-runner.git
cd qms-testnet-runner
```

**Windows — 一条命令安装依赖、配置钱包并运行：**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

**Linux / macOS：**

```sh
bash start.sh
```

首次运行会**隐藏输入**测试钱包私钥。请使用**独立测试钱包**；源码中没有任何可填私钥的字段。Windows 使用 **DPAPI**；Linux/macOS 使用 **ethers JSON keystore** 密码加密。设置过程不会打印密钥或密码；报告文件中也不包含它们。Runner 仅在本地签名，**不会**把私钥上传到任何服务。

将公钥地址复制到 [官方水龙头](https://faucet.testnet.qms.finance/)。默认流程需要 **0.65 test QMS**（含保守 gas 预留）。余额不足时会停止；领取测试币后再次运行启动器。水龙头的浏览器验证需手动完成。测试网代币无货币价值。

依赖安装完成后：

```sh
npm start
```

每次常规运行都会广播新一轮测试。Linux/macOS 每次运行会询问一次 keystore 密码。

## 工作流

| 步骤 | 说明 |
| --- | --- |
| 网络与 QWAP | 链 ID 19480，router/factory/token/pool 关系 |
| 钱包与预算 | 余额、gas 上限与原生 QMS 预留 |
| 部署 QmsCounter | 收据、运行时 bytecode、初始 count=0 |
| 递增 | count 0 → 1 与事件校验 |
| Swap | 0.2 QMS → 测试 USDC；收据与余额增加 |
| 流动性 | 按需 exact-amount approval，再 0.1 QMS + USDC 进 WQMS/USDC；LP 增加 |
| 最终余额 | 钱包、测试 USDC 与 LP |
| 区块 / QUBO | 区块 hash 匹配与 xᵀQx 整数计算 |

发送前会模拟；等待 **2** 个区块确认。步骤顺序执行，出错则停止后续步骤；已确认交易仍留在链上。QUBO 校验验证给定解的目标值，**不**证明全局最优。

## 选项

```sh
npm start -- --dry-run
npm start -- --swap-amount 0.2 --liquidity-amount 0.1 --slippage-bps 100
npm start -- --verbose
npm start -- --no-color
```

启动器预览：`bash start.sh --dry-run`，或 `powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1 --dry-run`。dry-run 不上链，并明确跳过依赖的 increment/liquidity。

默认：滑点 1%，每笔原生操作最多 1 QMS，每笔 gas 最多 0.05 QMS，保留 0.1 QMS 作 gas。滑点 1–500 bps（0.01%–5%）。

## 钱包配置

```sh
npm run key:import
```

会替换本地已保存的钱包。Windows DPAPI 绑定当前 Windows 用户与机器。Linux/macOS keystore 密码至少 12 字符；请自行备份钱包。已有 Windows 用户仍可用 `npm run all`；JSON keystore 请用 `npm start` 输入密码。高级集成可通过进程环境变量提供 `QMS_PRIVATE_KEY` 或 `QMS_KEYSTORE_PASSWORD`；**切勿**写入已提交文件或命令行参数。

`scripts/read-key.ps1` 为内部辅助脚本，CLI 在内存中捕获其 stdout。**不要**直接运行或把输出重定向到日志。

## 日志与恢复

输出包含编号步骤、交易链接、确认数、耗时与余额/gas 摘要。终端日志时间显示为 `Asia/Shanghai`。以下路径均被 Git 忽略：

- `.secrets/`：加密钱包文件
- `reports/run-latest.json`：最新工作流状态
- `reports/run-*.json` 与 `.log`：单次运行与可读日志
- `reports/tx-*.json`：已提交 hash 与收据状态
- `reports/block-*.json` 与 `.mtx.gz`：QUBO 证据
- `deployments/` 与 `artifacts/`：地址与编译输出

收据超时 180 秒；超时不等于失败。hash/nonce 等元数据在广播**前**写入日记；未决发送会阻止新提交；**不会**保存已签名 raw 交易。重复运行前请在浏览器中核对已记录 hash。若 approval 成功但 deposit 失败，链上仍会保留该有限 approval。若进程异常退出留下 `.cache/run-all.lock`，请先确认无活跃 runner、核对交易状态后再删除锁文件。

## 网络

| 项 | 值 |
| --- | --- |
| Chain ID | 19480 |
| RPC | https://rpc.testnet.qms.finance |
| 浏览器 | https://testnet.qmsscan.io |
| 水龙头 | https://faucet.testnet.qms.finance |
| DEX | https://testnet.qwap.xyz |

Router getter 为 `WQMS()`，已在链上确认。当前测试网对 `safe`/`finalized` 标签返回 genesis；收据检查使用区块确认数。测试网状态可能被重置。

## 开发与私钥安全

```sh
npm ci
npm test
npm run security:check
npm run compile
npm audit
```

可选只读联调：`npm run smoke`。单独工具：`npm run qms -- help`。CI 在 Windows、Linux、macOS 上运行且**不提供**钱包密钥；DPAPI 测试仅在 Windows 执行。可选浏览器验证的标准 JSON：`artifacts/standard-input.json`。源码验证不会自动提交。[MIT](LICENSE)

[安全控制与审查范围（中文）](SECURITY.zh.md) · [English security notes](SECURITY.md)

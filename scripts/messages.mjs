/** 终端与 CLI 面向用户的中文文案（简体）。 */

export const step = {
  networkQwap: '网络与 QWAP 检查',
  walletBudget: '钱包与总预算',
  deploy: '合约部署',
  incrementEvent: '计数递增与事件检查',
  increment: '计数递增',
  swap: 'QMS → USDC 兑换',
  liquidityFull: '授权与 WQMS/USDC 流动性',
  liquidityShort: '授权与流动性',
  finalWallet: '最终余额检查',
  blockQubo: '区块与 QUBO 解检查',
};

/** 旧报告中的土耳其语步骤名 → 中文展示 */
export const legacyStepLabels = {
  'Ag ve QWAP kontrolu': step.networkQwap,
  'Cuzdan ve toplam butce': step.walletBudget,
  'Kontrat deploy': step.deploy,
  'Sayac artirma ve event kontrolu': step.incrementEvent,
  'Sayac artirma': step.increment,
  'QMS -> USDC swap': step.swap,
  'Approval ve WQMS/USDC likidite': step.liquidityFull,
  'Approval ve likidite': step.liquidityShort,
  'Son bakiye kontrolu': step.finalWallet,
  'Blok ve QUBO cozumu kontrolu': step.blockQubo,
};

export const skipReason = {
  increment: '预检未部署新合约，已跳过计数递增。',
  liquidity: '预检中 swap 未改变余额，已跳过流动性步骤。',
};

export const phaseLabel = {
  'before-start': '未开始',
  active: '进行中',
  ended: '已结束',
  'local-status': '本地状态',
};

export const streakStatusLabel = {
  ready: '就绪',
  'already-completed': '今日已完成',
  waiting: '等待确认',
  preview: '预览',
  completed: '已完成',
  failed: '失败',
  'day-changed': '任务日变更',
  running: '运行中',
};

export const streakKind = { swap: 'swap', liquidity: 'liquidity' };

export const err = {
  unknown: '未知错误',
  chainId: '链 ID 不是 19480；已停止操作。',
  encryptedKeyRead: '无法读取加密密钥。请运行 npm run key:import。',
  keystoreLocked: 'Keystore 已锁定。请用 npm start 以隐藏方式输入密码。',
  keystoreOpen: '无法解锁 keystore；密码或文件无效。',
  noKey: '未找到密钥。请用 npm run key:import 在本地导入。',
  keyFormat: '私钥格式无效。',
  keyInvalid: '私钥无效。',
  walletChanged: '流程中记录的钱包已变更；已停止操作。',
  qmsAmount: 'QMS 数量须为正小数。',
  qmsRange: max => `测试数量须在 0 与 ${max} QMS 之间。`,
  slippage: '滑点须在 1–500 bps 之间。',
  minOutZero: '最小输出为零；金额过小。',
  gasCap: 'Gas 超过上限 0.05 QMS。',
  balanceLow: '余额不足：需要交易金额 + gas，并保留 0.1 QMS。请使用水龙头。',
  streakWalletCtx: 'Streak 钱包上下文不匹配。',
  nativeCap: '交易原生金额超过限制。',
  eip1559: '无法获取 EIP-1559 gas 数据。',
  streakBlockTime: '无法读取 Streak 所需的最新区块时间。',
  signedMismatch: '已签名交易与预期的钱包/目标/金额/gas 不一致；未发送。',
  rpcUnknown: 'RPC 发送结果不确定。Hash 已记录；请先查看浏览器再发起新交易。',
  receiptUnknown: '等待收据结果不确定。Hash 已记录；请先查看浏览器再重试。',
  receiptMissing: '未找到收据；请检查交易 hash 记录。',
  reverted: '链上交易已 revert；收据已记录。',
  noConfirmedReceipt: '未收到已确认收据。',
  networkQwap: '网络或 QWAP 校验失败。',
  workflowMinQms: required => `完整流程至少需要 ${required} QMS（含 gas 预留）。`,
  deployVerify: '部署后 bytecode 或 count 校验失败。',
  incrementVerify: '新合约计数未验证为 0 → 1。',
  swapUsdc: 'Swap 后 USDC 余额未增加。',
  lpMint: '添加流动性后 LP 未增加。',
  walletSwitch: '流程中钱包地址发生变化。',
  quboObjective: 'QUBO 目标值校验失败。',
  unexpectedCli: 'CLI 输出格式异常。',
  cliJsonIncomplete: 'CLI JSON 输出不完整。',
  flowInterrupted: '流程已被用户中断。',
  runAllLock: '另有批量流程正在运行，或遗留锁文件：.cache/run-all.lock',
  streakWrongWallet: 'Streak 记录属于其他钱包。',
  streakLock: '另有测试/Streak 流程正在运行，或遗留锁文件。',
  streakInterrupted: 'Streak 已被用户中断。',
  streakDailyNeed: needed => `当日剩余流程需要 ${needed} QMS。`,
  streakDates: 'Streak 日期配置无效。',
  streakDay: 'Streak 天数须为 1–7。',
  streakOpKind: 'Streak 操作类型无效。',
  streakRole: '角色须为 standard、pioneer 或 qwabbit。',
  streakTxRead: '无法读取交易记录；未发送 Streak 交易。',
  streakWrongCampaign: 'Streak 记录属于其他活动。',
  taskCtx: '每日任务上下文无效。',
  taskDate: '每日任务日期与活动日不匹配。',
  taskOutside: '不在 Streak 任务日内，无法发送交易。',
  txHashFormat: '交易 hash 格式无效。',
  txLock: '该钱包另有交易进行中，或遗留锁文件。请检查记录。',
  txRecordRead: '某笔交易记录无法读取；未发送新交易。',
  txUnresolved: '该钱包存在结果未决或未确认的交易；请先用浏览器核对 reports/tx-*.json。',
  streakPrevUnknown: '上一笔 Streak 交易结果未决；未重复发送。',
  streakPrevBlock: '无法读取上一笔 Streak 交易的区块时间。',
  streakDupDay: '本任务日内该 Streak 操作已成功；未重复发送。',
  secretDirSymlink: '密钥目录不能为符号链接。',
  secretFileSymlink: '目标文件不能为符号链接。',
  secretNeedTty: '隐藏输入需要交互式终端。请勿在命令行参数中粘贴密钥。',
  secretCancelled: '已取消隐藏输入。',
  keyHexLen: '私钥须为 64 位十六进制字符。',
  keyInvalidPortable: '私钥无效。',
  keystorePassLen: 'Keystore 密码至少 12 个字符。',
  keystorePassMatch: '两次输入的密码不一致。',
  winKeyImport: '无法启动 Windows 密钥导入。',
  winKeySave: '无法保存密钥。',
  contractMissing: name => `地址 ${name} 上无合约。`,
  qwapRelations: 'QWAP router/factory/token/pool 关系校验失败。',
  usdcMeta: 'USDC 元数据不符合预期。',
  poolEmpty: '池内无流动性。',
  blockStale: '最新区块时间过旧。请检查网络状态。',
  blockNumber: '区块号须为正整数。',
  blockHashMismatch: 'RPC 与浏览器区块 hash 不一致。',
  quboWrongBlock: 'QUBO 元数据属于其他区块。',
  quboMissing: '无 QUBO 元数据；未下载 instance。',
  instanceHttp: status => `Instance HTTP ${status}`,
  instanceSize: 'Instance 超过 32 MiB 限制。',
  instanceGzip: 'Instance 不是 gzip 格式。',
  oneCommand: '请只输入一个子命令。',
  unknownCommand: '未知命令；请使用 npm run qms -- help。',
  deployBytecode: '部署 bytecode 校验失败。',
  counterNotZero: '计数器初始值不是零。',
  compileFirst: '请先运行 compile 与 deploy。',
  noDeployRecord: '无部署记录；请提供 --contract 地址。',
  deployWrongChain: '部署记录属于其他网络。',
  bytecodeMismatch: '地址上的 bytecode 与 QmsCounter 不匹配。',
  counterEvent: '计数递增或事件校验失败。',
  usdcForLp: 'USDC 不足以添加流动性；请先 swap。',
  lpBalance: 'LP 余额未增加。',
  smokeDeploy: '部署模拟的运行时 bytecode 结果不匹配。',
  smokeCounter: '计数器初始值无效。',
  smokeSwap: 'Swap 模拟未产生输出。',
  quboFormat: '不支持的 Matrix Market 格式。',
  quboSize: 'QUBO 矩阵尺寸无效。',
  quboSolution: 'QUBO 解的尺寸或比特无效。',
  quboCoeffs: 'QUBO 系数数量无效。',
  quboInt: 'QUBO 系数不是整数。',
  quboObjective: '计算的 QUBO 目标值与浏览器不一致。',
  streakEvidence: '交易后未能验证预期的链上证据。',
  streakWaitingBoth: '两项任务的链上证据未能一起验证。',
  streakWaitingPending: '存在待确认或无法验证的 Streak 交易。',
  streakPreviewReason: 'Swap 与 LP 计划；未上链。',
  streakDayChangedRun: '任务日已变更；请在新任务日重新运行命令。',
  streakDayChangedBlock: '交易落在不同任务日；证据按实际区块时间保存。',
  streakMaybeSentReason: '交易可能已发送；等待根据 hash 记录确认。',
  childStart: '无法启动子命令。',
  flowStopped: '流程已停止。',
  actionFailed: name => `${name} 失败。`,
  noCommandOutput: '命令未产生结果数据。',
  streakChildStart: '无法启动 Streak 子命令。',
  streakChildStop: 'Streak 子命令已停止。',
  daemonInterval: '守护进程检查间隔须为 1–1440 分钟。',
  daemonNoPrepare: '请先运行 npm run streak:prepare 完成 Streak 钱包绑定。',
  daemonWrongCampaign: 'Streak 绑定与当前 config/streak.json 活动不一致；请重新 prepare。',
  daemonStopped: '守护进程已停止。',
};

export const log = {
  encryptingKeystore: '正在加密本地 keystore…',
  keystoreSaved: '加密 keystore 已保存到本地 .secrets/。',
  keyImportFailed: prefix => `${prefix}失败：`,
  startupFailed: '启动失败：',
  errorPrefix: '错误：',
  securityScan: (commits, versions, count) =>
    `安全扫描：${commits} 个提交、${versions} 个文件版本、${count} 条发现。`,
  securityScanFailed: '仓库安全扫描未能完成。',
  startBanner: '\nQMS Testnet Runner · 本地钱包设置\n',
  testnetWalletHint: '请使用独立的测试网钱包。私钥输入已隐藏。',
  walletLine: addr => `钱包：${addr}`,
  faucetLine: url => `免费测试 QMS 水龙头：${url}`,
  workflowNeed: qms => `默认金额与 gas 预留下，流程需要 ${qms} QMS。\n`,
  runAllHelp: `npm run all  （全部步骤上链）
npm run all -- --dry-run  （预检）
选项：--swap-amount 0.2 --liquidity-amount 0.1 --slippage-bps 100 --verbose --no-color`,
  runAllStatusNote: '状态见 reports/run-latest.json。若已发送 hash，请先核对收据再重启。',
  streakHelp: `npm run streak:prepare
npm run streak
npm run streak:status
npm run streak -- --dry-run
角色估算：--role standard|pioneer|qwabbit`,
  streakBeforeStart: '开始前不会上链。请先：npm run streak:prepare',
  streakProgress: (status, completed, missed) =>
    `STREAK · ${status} · 已完成 ${completed}/7 天 · 错过 ${missed} 天`,
  streakRange: (start, end) => `开始：${start} · 结束：${end}（北京时间）`,
  streakDayLine: (day, ends) => `任务日 ${day}/7 · 截止：${ends}`,
  streakQuanta: (q, bonus) =>
    `本地 Quanta 估算：${q} · 6 天加成：${bonus === 'yes' ? '符合' : bonus === 'maybe' ? '尚未达成' : '已不可能'}`,
  streakOfficialDisclaimer: '本工具不验证官方 Quanta 积分或 Discord 角色。',
  streakWalletPhase: (address, phase) => `STREAK · 钱包 ${address} · ${phase}`,
  streakCmd: (cmd, onChain) => `→ ${cmd} ${onChain ? '· 链上交易与证据检查' : '· 只读检查'}`,
  streakWaiting: '等待交易/检查结果…',
  streakBudget: (perDay, week) =>
    `每日保守预算：${perDay} QMS；7 天 + 预留：${week} QMS。`,
  streakPrepareDone: '准备完成。常驻调度：npm run streak:daemon（或 npm run streak:daemon:install）。',
  streakStateFile: file => `状态文件：${file}`,
  streakTodayDone: '今日 swap 与 LP 已验证；不会重复发送。',
  streakWaitingProof: '存在待确认或无法验证的 Streak 交易。',
  streakPreview: 'Swap 与 LP 计划；未上链。',
  streakKindSkip: kind => `${kind}：已完成，跳过。`,
  streakDayChanged: '任务日已变更；请在新任务日重新运行命令。',
  streakMaybeSent: '交易可能已发送；等待根据 hash 记录确认。',
  streakDayChangedProof: '交易落在不同任务日；证据按实际区块时间保存。',
  streakWaitingBoth: '两项任务的链上证据未能一起验证。',
  streakWaitingPending: '存在待确认或无法验证的 Streak 交易。',
  streakPreviewReason: 'Swap 与 LP 计划；未上链。',
  streakDayChangedRun: '任务日已变更；请在新任务日重新运行命令。',
  streakDayChangedBlock: '交易落在不同任务日；证据按实际区块时间保存。',
  streakMaybeSentReason: '交易可能已发送；等待根据 hash 记录确认。',
  childStart: '无法启动子命令。',
  flowStopped: '流程已停止。',
  actionFailed: name => `${name} 失败。`,
  noCommandOutput: '命令未产生结果数据。',
  streakChildStart: '无法启动 Streak 子命令。',
  streakChildStop: 'Streak 子命令已停止。',
  daemonStarted: (minutes, address) => {
    const cadence = minutes >= 1440 && minutes % 1440 === 0
      ? `每 ${minutes / 1440} 天（${minutes} 分钟）`
      : `每 ${minutes} 分钟`;
    return `Streak 守护进程已启动 · ${cadence} 检查 · 钱包 ${address}`;
  },
  daemonTick: phase => `执行 Streak 检查 · 活动阶段：${phase}`,
  daemonChildExit: code => `Streak 子进程结束 · 退出码 ${code}`,
  daemonCampaignEnded: end => `活动已结束（${end}），守护进程退出。`,
  daemonHelp: `npm run streak:daemon              常驻运行（默认每 24 小时检查一次）
npm run streak:daemon -- --once    只执行一轮
npm run streak:daemon -- --interval-minutes 60
npm run streak:daemon:install        Linux/macOS：安装 systemd 用户服务（开机自启）
npm run streak:daemon:uninstall
可选：在 .secrets/daemon.env 中设置 QMS_KEYSTORE_PASSWORD（勿提交 Git）`,
  daemonNeedSetup: '缺少钱包或 Streak 准备。请先 npm run key:import 与 npm run streak:prepare。',
};

export const qmsUsage = `QMS Testnet (19480)
  npm run status
  npm run key:import                       本地隐藏导入私钥
  npm run qms -- wallet [--address 0x...]
  npm run compile
  npm run qms -- deploy [--broadcast]
  npm run qms -- increment [--contract 0x...] [--broadcast]
  npm run qms -- quote --amount 0.1
  npm run qms -- swap --amount 0.1 [--slippage-bps 100] [--broadcast]
  npm run qms -- liquidity --amount 0.1 [--slippage-bps 100] [--broadcast]
  npm run qms -- block [--number 57173] [--download]
无 --broadcast 时不会上链。默认金额：0.1 QMS。
流动性会将原生 QMS 经 router 包装为 WQMS；需要 USDC 余额。`;

export const prompts = {
  privateKey: '测试钱包私钥（隐藏输入）',
  keystorePassword: '本地 keystore 密码（至少 12 个字符）',
  keystorePasswordRepeat: '再次输入 keystore 密码',
  keystoreUnlock: '解锁本地 keystore（密码隐藏输入）',
};

export const safe = { hexHidden: '[已隐藏 hex]' };

export const streakNote = {
  estimatedFooter: '根据本地链上证据估算；未验证官方 Quanta 或 Discord 角色。',
};

/** 将 ISO 时间格式化为中文本地时间（Asia/Shanghai） */
export function formatLocalTime(iso) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function streakBonusLabel({ bonusEligible, bonusStillPossible }) {
  if (bonusEligible) return 'yes';
  if (bonusStillPossible) return 'maybe';
  return 'no';
}

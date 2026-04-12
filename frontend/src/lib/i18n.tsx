'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'zh' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  // ─── Nav & Layout ───
  'nav.title': { zh: 'CLAW WORLD v2.0', en: 'CLAW WORLD v2.0' },
  'nav.world': { zh: '终端', en: 'TERMINAL' },
  'nav.mint': { zh: '铸造', en: 'MINT' },
  'nav.vault': { zh: '合集', en: 'VAULT' },
  'nav.data': { zh: '指南', en: 'DATA' },
  'nav.lore': { zh: 'AI代理', en: 'AI AGENT' },
  'nav.openclaw': { zh: '开始', en: 'PLAY' },
  'nav.game': { zh: '游戏', en: 'GAME' },
  'openclaw.title': { zh: 'OpenClaw 游戏指南', en: 'OpenClaw Game Guide' },
  'nav.home': { zh: '首页', en: 'Home' },
  'nav.guide': { zh: '指南', en: 'Guide' },
  'nav.nfa': { zh: 'NFA', en: 'NFA' },
  'nav.menu': { zh: '菜单', en: 'MENU' },
  'nav.close': { zh: '关闭', en: 'CLOSE' },
  'nav.navigate': { zh: '> 导航：', en: '> NAVIGATE:' },
  'shell.play': { zh: '行动', en: 'Play' },
  'shell.arena': { zh: '竞技', en: 'Arena' },
  'shell.auto': { zh: '代理', en: 'Auto' },
  'shell.settings': { zh: '设置', en: 'Settings' },
  'shell.primaryNav': { zh: '主导航', en: 'Primary navigation' },
  'shell.companion': { zh: '龙虾伙伴', en: 'Lobster Companion' },
  'shell.openCompanion': { zh: '打开伙伴', en: 'Open Companion' },
  'shell.taskQueue': { zh: '任务队列', en: 'Task Queue' },
  'shell.arenaHub': { zh: '竞技中心', en: 'Arena Hub' },
  'shell.autonomy': { zh: 'AI 代理', en: 'Autonomy' },
  'shell.selector': { zh: '当前龙虾选择器', en: 'Active lobster selector' },
  'shell.previous': { zh: '上一只龙虾', en: 'Previous lobster' },
  'shell.next': { zh: '下一只龙虾', en: 'Next lobster' },
  'shell.switchToEnglish': { zh: '切换到英文', en: 'Switch to English' },
  'shell.switchToChinese': { zh: '切换到中文', en: 'Switch to Chinese' },
  'shell.reserve': { zh: '储备', en: 'Reserve' },
  'shell.runway': { zh: '续航', en: 'Runway' },
  'shell.tasks': { zh: '任务', en: 'Tasks' },
  'shell.upkeep': { zh: '维护', en: 'Upkeep' },
  'shell.source': { zh: '来源', en: 'Source' },
  'shell.owned': { zh: '持有', en: 'Owned' },
  'shell.status': { zh: '状态', en: 'Status' },
  'shell.pk': { zh: 'PK', en: 'PK' },
  'shell.wins': { zh: '胜场', en: 'Wins' },
  'shell.loop': { zh: '循环', en: 'Loop' },
  'shell.wallet': { zh: '钱包', en: 'Wallet' },
  'shell.lowGasPath': { zh: '低 gas 路径', en: 'Low gas path' },
  'shell.brWarming': { zh: '大逃杀预热中', en: 'BR warming' },
  'shell.revealTracked': { zh: 'Reveal 已追踪', en: 'Reveal tracked' },
  'shell.directiveSynced': { zh: '指令已同步', en: 'Directive synced' },
  'shell.policyLocked': { zh: '策略已锁定', en: 'Policy locked' },
  'shell.alertsConfigurable': { zh: '提醒可配置', en: 'Alerts configurable' },

  // ─── Hero ───
  'hero.title': { zh: '终端访问', en: 'TERMINAL ACCESS' },
  'hero.status': { zh: '状态', en: 'STATUS' },
  'hero.nominal': { zh: '正常', en: 'NOMINAL' },
  'hero.desc': { zh: 'AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存...', en: 'Beneath the AXIOM-ruled surface, humans and AI lobster companions coexist...' },

  // ─── World Status ───
  'world.title': { zh: '世界状态', en: 'WORLD STATUS' },
  'world.rewardMul': { zh: '奖励倍率', en: 'REWARD MULTIPLIER' },
  'world.pkCap': { zh: 'PK 质押上限', en: 'PK STAKE CAP' },
  'world.mutBonus': { zh: '变异加成', en: 'MUTATION BONUS' },
  'world.dailyCost': { zh: '日消耗', en: 'DAILY COST' },
  'world.events': { zh: '事件', en: 'EVENTS' },
  'world.sync': { zh: '> 正在同步世界状态...', en: '> RUNNING WORLD_STATE_SYNC.EXE...' },

  // ─── Claworld Token ───
  'token.title': { zh: 'Claworld 代币', en: 'Claworld Token' },
  'token.status': { zh: '状态', en: 'STATUS' },
  'token.graduated': { zh: '已毕业 · PANCAKESWAP', en: 'GRADUATED · PANCAKESWAP' },
  'token.bonding': { zh: '联合曲线 · FLAP', en: 'BONDING CURVE · FLAP' },
  'token.trade': { zh: '前往交易', en: 'OPEN TRADE' },
  'token.copy': { zh: '复制', en: 'COPY' },
  'token.copied': { zh: '已复制', en: 'COPIED' },
  'token.supply': { zh: '总供应量', en: 'Total Supply' },
  'token.contract': { zh: '合约', en: 'Contract' },
  'token.viewPrice': { zh: '查看价格', en: 'VIEW PRICE' },

  // ─── Core Systems ───
  'core.title': { zh: '核心系统', en: 'CORE SYSTEMS' },

  // ─── System Logs ───
  'log.title': { zh: '系统日志', en: 'SYSTEM LOGS' },
  'log.1': { zh: '完整性检查通过，未检测到辐射泄漏。', en: 'INTEGRITY CHECK PASSED. NO RAD-LEAKS DETECTED.' },
  'log.2': { zh: '正在获取区块链数据... 已同步。', en: 'FETCHING BLOCKCHAIN DATA... SYNCED.' },
  'log.3': { zh: '警告：辐射风暴即将抵达 7-G 区域。', en: 'WARNING: RADSTORM INBOUND IN SECTOR 7-G.' },
  'log.4': { zh: 'NFA #0247 性格偏移已检测。', en: 'NFA #0247 PERSONALITY SHIFT DETECTED.' },
  'log.5': { zh: '世界状态更新：奖励倍率重新计算。', en: 'WORLD STATE UPDATE: REWARD MULTIPLIER RECALC.' },
  'log.awaiting': { zh: '等待输入...', en: 'AWAITING INPUT...' },

  // ─── Status ───
  'status.alive': { zh: '● 活跃', en: '● ALIVE' },
  'status.dormant': { zh: '○ 休眠', en: '○ DORMANT' },
  'status.notConnected': { zh: '未连接', en: 'NOT CONNECTED' },

  // ─── Loading ───
  'loading': { zh: '加载中...', en: 'LOADING...' },
  'loading.db': { zh: '正在加载数据库...', en: 'LOADING DATABASE...' },

  // ─── Wallet ───
  'wallet.connect': { zh: '连接钱包', en: 'Connect Wallet' },
  'wallet.disconnect': { zh: '断开', en: 'Disconnect' },

  // ─── Error ───
  'error.system': { zh: '[系统错误]', en: '[SYSTEM ERROR]' },
  'error.unexpected': { zh: '发生了意外错误', en: 'An unexpected error occurred' },
  'error.retry': { zh: '[重试]', en: '[RETRY]' },

  // ─── Env Banner ───
  'env.demo': { zh: '[ DEMO MODE — 模拟数据 ]', en: '[ DEMO MODE — LOCAL ]' },
  'env.testnet': { zh: '[ TESTNET — 测试网络 ]', en: '[ TESTNET — BSC TESTNET ]' },

  // ─── Footer ───
  'footer.wallet': { zh: '钱包', en: 'WALLET' },

  // ─── NFA Collection ───
  'nfa.database': { zh: 'NFA 数据库', en: 'NFA Database' },
  'nfa.subtitle': { zh: '— 已铸造龙虾合集', en: '— Minted Lobster Collection' },
  'nfa.records': { zh: '条记录', en: 'records' },
  'nfa.total': { zh: '共', en: 'Total' },
  'nfa.view': { zh: '查看', en: 'View' },
  'nfa.mine': { zh: '我', en: 'Mine' },
  'nfa.myTag': { zh: '我的', en: 'Mine' },
  'nfa.empty': { zh: '暂无已铸造的龙虾', en: 'No minted lobsters yet' },
  'nfa.emptyHint': { zh: '龙虾铸造后将在此展示', en: 'Lobsters will appear here after minting' },
  'nfa.noMatch': { zh: '没有匹配的龙虾', en: 'No matching lobsters' },
  'nfa.noMatchHint': { zh: '尝试调整筛选条件', en: 'Try adjusting filters' },
  'nfa.notExist': { zh: '不存在或尚未铸造', en: 'does not exist or not yet minted' },
  'nfa.backToList': { zh: '返回合集', en: 'Back to Collection' },

  // ─── NFA Table Headers ───
  'th.id': { zh: 'ID', en: 'ID' },
  'th.name': { zh: '名称', en: 'Name' },
  'th.level': { zh: '等级', en: 'Level' },
  'th.rarity': { zh: '稀有度', en: 'Rarity' },
  'th.shelter': { zh: '据点', en: 'Shelter' },
  'th.status': { zh: '状态', en: 'Status' },

  // ─── Filter ───
  'filter.label': { zh: '筛选:', en: 'Filter:' },
  'filter.allRarity': { zh: '全部稀有度', en: 'All Rarity' },
  'filter.allShelter': { zh: '全部据点', en: 'All Shelters' },
  'filter.allStatus': { zh: '全部状态', en: 'All Status' },
  'filter.alive': { zh: '活跃', en: 'Alive' },
  'filter.dormant': { zh: '休眠', en: 'Dormant' },
  'filter.idAsc': { zh: 'ID ▲', en: 'ID ▲' },
  'filter.idDesc': { zh: 'ID ▼', en: 'ID ▼' },
  'filter.levelDesc': { zh: '等级 ▼', en: 'Level ▼' },
  'filter.levelAsc': { zh: '等级 ▲', en: 'Level ▲' },
  'filter.rarityDesc': { zh: '稀有度 ▼', en: 'Rarity ▼' },
  'filter.rarityAsc': { zh: '稀有度 ▲', en: 'Rarity ▲' },
  'filter.myLobster': { zh: '我的龙虾', en: 'My Lobsters' },
  'filter.list': { zh: '列表', en: 'List' },
  'filter.grid': { zh: '网格', en: 'Grid' },

  // ─── NFA Detail ───
  'detail.rarity': { zh: '稀有度', en: 'Rarity' },
  'detail.level': { zh: '等级', en: 'Level' },
  'detail.shelter': { zh: '据点', en: 'Shelter' },
  'detail.status': { zh: '状态', en: 'Status' },
  'detail.job': { zh: '职业', en: 'Job Class' },
  'detail.balance': { zh: 'Claworld余额', en: 'Claworld Balance' },
  'detail.dailyCost': { zh: '日消耗', en: 'Daily Cost' },
  'detail.sustain': { zh: '可维持', en: 'Sustain' },
  'detail.owner': { zh: '拥有者', en: 'Owner' },
  'detail.days': { zh: '天', en: 'days' },
  'detail.perDay': { zh: '/天', en: '/day' },
  'detail.unknown': { zh: '未知', en: 'Unknown' },

  // ─── NFA Detail Tabs ───
  'tab.status': { zh: '状态', en: 'Status' },
  'tab.special': { zh: 'SPECIAL', en: 'SPECIAL' },
  'tab.ai': { zh: 'AI代理', en: 'AI AGENT' },
  'tab.gene': { zh: '基因', en: 'Gene' },
  'tab.maintain': { zh: '维护', en: 'Maintain' },

  // ─── Gene / DNA ───
  'gene.title': { zh: '基因组 / DNA', en: 'Genome / DNA' },
  'gene.str': { zh: '力量', en: 'STR' },
  'gene.def': { zh: '防御', en: 'DEF' },
  'gene.spd': { zh: '速度', en: 'SPD' },
  'gene.vit': { zh: '生命', en: 'VIT' },

  // ─── Mutation ───
  'mutation.slot1': { zh: '变异槽 I', en: 'Mutation Slot I' },
  'mutation.slot2': { zh: '变异槽 II', en: 'Mutation Slot II' },
  'mutation.active': { zh: '已激活', en: 'Active' },
  'mutation.locked': { zh: '未解锁', en: 'Locked' },

  // ─── Job Classes ───
  'job.0': { zh: '探索者', en: 'Explorer' },
  'job.1': { zh: '外交官', en: 'Diplomat' },
  'job.2': { zh: '创造者', en: 'Creator' },
  'job.3': { zh: '守护者', en: 'Guardian' },
  'job.4': { zh: '学者', en: 'Scholar' },
  'job.5': { zh: '先驱者', en: 'Pioneer' },

  // ─── Stat Descriptions ───
  'stat.STR': { zh: '力量决定龙虾的近战攻击力，影响 PK 中的物理伤害输出。', en: 'Strength determines melee attack power and physical damage in PK battles.' },
  'stat.DEF': { zh: '防御决定龙虾的抗打击能力，降低受到的伤害。', en: 'Defense determines damage resistance, reducing incoming damage.' },
  'stat.SPD': { zh: '速度决定龙虾的行动优先级，速度高者先手攻击。', en: 'Speed determines action priority — faster lobsters strike first.' },
  'stat.VIT': { zh: '生命决定龙虾的最大 HP，影响战斗持久力。', en: 'Vitality determines max HP and combat endurance.' },
  'stat.courage': { zh: '勇气影响 PK 发起率和危险探索的成功率。', en: 'Courage affects PK initiation rate and dangerous exploration success.' },
  'stat.wisdom': { zh: '智慧影响任务奖励和对话中获取情报的效率。', en: 'Wisdom affects task rewards and intelligence-gathering efficiency.' },
  'stat.social': { zh: '社交影响与其他龙虾的合作成功率和交易价格。', en: 'Social affects cooperation success rate and trade prices.' },
  'stat.create': { zh: '创造影响制作道具的品质和发现变异的概率。', en: 'Create affects crafted item quality and mutation discovery chance.' },
  'stat.grit': { zh: '韧性影响龙虾濒死时的存活概率和恢复速度。', en: 'Grit affects survival chance when near death and recovery speed.' },

  // ─── Stat Labels ───
  'statLabel.STR': { zh: '力量', en: 'STR' },
  'statLabel.DEF': { zh: '防御', en: 'DEF' },
  'statLabel.SPD': { zh: '速度', en: 'SPD' },
  'statLabel.VIT': { zh: '生命', en: 'VIT' },
  'statLabel.courage': { zh: '勇气', en: 'Courage' },
  'statLabel.wisdom': { zh: '智慧', en: 'Wisdom' },
  'statLabel.social': { zh: '社交', en: 'Social' },
  'statLabel.create': { zh: '创造', en: 'Create' },
  'statLabel.grit': { zh: '韧性', en: 'Grit' },

  // ─── Stat English Labels ───
  'statEn.STR': { zh: 'Strength', en: 'Strength' },
  'statEn.DEF': { zh: 'Defense', en: 'Defense' },
  'statEn.SPD': { zh: 'Speed', en: 'Speed' },
  'statEn.VIT': { zh: 'Vitality', en: 'Vitality' },
  'statEn.courage': { zh: 'Courage', en: 'Courage' },
  'statEn.wisdom': { zh: 'Wisdom', en: 'Wisdom' },
  'statEn.social': { zh: 'Social', en: 'Social' },
  'statEn.create': { zh: 'Create', en: 'Create' },
  'statEn.grit': { zh: 'Grit', en: 'Grit' },

  // ─── Deposit ───
  'deposit.title': { zh: '充值', en: 'Deposit' },
  'deposit.connectWallet': { zh: '连接钱包以进行充值', en: 'Connect wallet to deposit' },
  'deposit.mode': { zh: '> 模式:', en: '> Mode:' },
  'deposit.quick': { zh: '> 快选:', en: '> Quick:' },
  'deposit.clwAmount': { zh: 'Claworld 数量', en: 'Claworld amount' },
  'deposit.bnbAmount': { zh: ' 数量', en: ' amount' },
  'deposit.signing': { zh: '签名...', en: 'Signing...' },
  'deposit.confirming': { zh: '确认中...', en: 'Confirming...' },
  'deposit.approve': { zh: '授权 Claworld', en: 'Approve Claworld' },
  'deposit.confirm': { zh: '确认充值', en: 'Confirm Deposit' },
  'deposit.needApprove': { zh: '[!] 需要先授权 Claworld，将弹出两次交易', en: '[!] Claworld approval required, two transactions will be prompted' },
  'deposit.approveHint': { zh: '[!] 首次充 Claworld 会先弹出授权交易。有些钱包会把这一步显示成“第三方合约 / 未解析资产变动”。先确认授权，再点一次充值即可。', en: '[!] The first Claworld deposit opens an approval transaction. Some wallets describe it as a third-party contract or unparsed asset change. Approve first, then click deposit again.' },
  'deposit.balance': { zh: '钱包余额', en: 'Wallet Balance' },
  'deposit.insufficientClw': { zh: '[!] 钱包中的 Claworld 余额不足，无法完成充值', en: '[!] Not enough Claworld balance in wallet to deposit' },
  'deposit.viewTx': { zh: '查看交易 →', en: 'View Transaction →' },
  'deposit.pendingGrad': { zh: '(待毕业)', en: '(pending graduation)' },
  'deposit.unavailable': { zh: '(未启用)', en: '(unavailable)' },
  'deposit.quickUnavailable': { zh: '[!] 快捷充值路由当前未启用，请先用 BNB 或 Claworld 直接充值', en: '[!] Quick buy-and-deposit is not enabled right now. Use direct BNB or Claworld deposit first.' },

  // ─── Mint ───
  'mint.progress': { zh: '铸造进度', en: 'Mint Progress' },
  'mint.total': { zh: '总量', en: 'Total' },
  'mint.instructions': { zh: '铸造说明', en: 'Mint Instructions' },
  'mint.inst1': { zh: '> commit-reveal 两步机制', en: '> commit-reveal two-step mechanism' },
  'mint.inst2': { zh: '> 1. 选择稀有度 → 提交', en: '> 1. Select rarity → commit' },
  'mint.inst3': { zh: '> 2. 等 1 分钟 → 揭示', en: '> 2. Wait 1 min → reveal' },
  'mint.inst4': { zh: '> 24h 未揭示可退款', en: '> Refund available if not revealed in 24h' },
  'mint.inst5': { zh: '> [!] 勿清浏览器数据', en: '> [!] Do not clear browser data' },
  'mint.genesis': { zh: '创世铸造 — Genesis Mint', en: 'Genesis Mint' },
  'mint.connectWallet': { zh: '连接钱包以进行铸造', en: 'Connect wallet to mint' },
  'mint.notStarted': { zh: '[!] 铸造尚未开始', en: '[!] Minting has not started yet' },
  'mint.selectRarity': { zh: '> 选择稀有度:', en: '> Select rarity:' },
  'mint.soldOut': { zh: '[售罄]', en: '[SOLD OUT]' },
  'mint.selected': { zh: '> 已选:', en: '> Selected:' },
  'mint.cost': { zh: '> 费用:', en: '> Cost:' },
  'mint.airdrop': { zh: '空投', en: 'Airdrop' },
  'mint.signing': { zh: '签名...', en: 'Signing...' },
  'mint.confirming': { zh: '确认中...', en: 'Confirming...' },
  'mint.confirmMint': { zh: '确认铸造', en: 'Confirm Mint' },
  'mint.viewTx': { zh: '查看交易 →', en: 'View Transaction →' },
  'mint.waiting': { zh: '等待揭示窗口...', en: 'Waiting for reveal window...' },
  'mint.committed': { zh: '提交已记录，揭示窗口将在倒计时结束后开放', en: 'Commitment recorded. Reveal window opens after countdown.' },
  'mint.revealOpen': { zh: '揭示窗口已开放!', en: 'Reveal window is open!' },
  'mint.revealTime': { zh: '剩余揭示时间:', en: 'Remaining reveal time:' },
  'mint.noSalt': { zh: '[!] 未找到本地 salt 数据。如果您清除了浏览器数据，需要等待 24 小时后申请退款。', en: '[!] Local salt data not found. If you cleared browser data, wait 24h to claim refund.' },
  'mint.revealBtn': { zh: '揭示你的龙虾 NFA', en: 'Reveal your Lobster NFA' },
  'mint.expired': { zh: '[!] 揭示窗口已过期', en: '[!] Reveal window has expired' },
  'mint.expiredDesc': { zh: '超过 24 小时未揭示。你可以申请退回已支付的', en: 'Not revealed within 24 hours. You can claim a refund of the paid' },
  'mint.refund': { zh: '申请退款', en: 'Claim Refund' },
  'mint.success': { zh: '铸造成功!', en: 'Mint Successful!' },
  'mint.successDesc': { zh: '你的创世龙虾 NFA 已铸造', en: 'Your Genesis Lobster NFA has been minted' },
  'mint.viewMintTx': { zh: '查看铸造交易 →', en: 'View Mint Transaction →' },
  'mint.viewCollection': { zh: '查看 NFA 合集', en: 'View NFA Collection' },
  'mint.mintAnother': { zh: '铸造另一个', en: 'Mint Another' },
  'mint.adminFree': { zh: '[ADMIN] 免费铸造', en: '[ADMIN] Free Mint' },
  'mint.recipientPlaceholder': { zh: '接收地址 (留空 = 自己)', en: 'Recipient address (empty = self)' },
  'mint.invalidAddr': { zh: '无效的以太坊地址', en: 'Invalid Ethereum address' },
  'mint.freeMint': { zh: '免费铸造', en: 'Free Mint' },
  'mint.continueBtn': { zh: '继续铸造', en: 'Continue Minting' },
  'mint.simFail': { zh: '模拟失败', en: 'Simulation Failed' },

  // ─── Transfer to OpenClaw ───
  'transfer.title': { zh: '转移到 OpenClaw', en: 'Transfer to OpenClaw' },
  'transfer.explain': { zh: '将龙虾转移到你的 OpenClaw 本地钱包，让它成为真正的链上智能体。转移后，龙虾将在 OpenClaw 中自主行动——做任务、PK、交易。', en: 'Transfer your lobster to your OpenClaw local wallet to make it a true on-chain agent. After transfer, the lobster will act autonomously in OpenClaw — completing tasks, PvP battles, and trading.' },
  'transfer.howTo': { zh: '如何获取 OpenClaw 地址：', en: 'How to get your OpenClaw address:' },
  'transfer.step1': { zh: '安装 OpenClaw: npm install -g openclaw', en: 'Install OpenClaw: npm install -g openclaw' },
  'transfer.step2': { zh: '安装 Skill: git clone https://github.com/fa762/claw-world-skill ~/.openclaw/skills/claw-world', en: 'Install Skill: git clone https://github.com/fa762/claw-world-skill ~/.openclaw/skills/claw-world' },
  'transfer.step3': { zh: '开始新对话，龙虾会自动引导你创建钱包', en: 'Start a new conversation — the lobster will guide you to create a wallet' },
  'transfer.placeholder': { zh: 'OpenClaw 钱包地址 (0x...)', en: 'OpenClaw wallet address (0x...)' },
  'transfer.sameAddress': { zh: '不能转给自己', en: 'Cannot transfer to yourself' },
  'transfer.invalidAddress': { zh: '无效地址', en: 'Invalid address' },
  'transfer.signing': { zh: '签名中...', en: 'Signing...' },
  'transfer.confirming': { zh: '链上确认中...', en: 'Confirming on-chain...' },
  'transfer.confirm': { zh: '确认转移', en: 'Confirm Transfer' },
  'transfer.warning': { zh: '⚠ 转移后此钱包将失去龙虾所有权。请确认 OpenClaw 地址正确。', en: '⚠ After transfer, this wallet will lose ownership. Make sure the OpenClaw address is correct.' },
  'transfer.success': { zh: '✅ 龙虾已转移到 OpenClaw！', en: '✅ Lobster transferred to OpenClaw!' },
  'transfer.successHint': { zh: '现在打开 OpenClaw，安装 claw-world skill，开始和你的龙虾对话吧！', en: 'Now open OpenClaw, install the claw-world skill, and start chatting with your lobster!' },
  'transfer.openclawInstall': { zh: '安装命令: git clone https://github.com/fa762/claw-world-skill ~/.openclaw/skills/claw-world && cd ~/.openclaw/skills/claw-world && npm install', en: 'Install: git clone https://github.com/fa762/claw-world-skill ~/.openclaw/skills/claw-world && cd ~/.openclaw/skills/claw-world && npm install' },
  'transfer.viewTx': { zh: '查看交易 →', en: 'View Transaction →' },

  // ─── Upkeep ───
  'upkeep.label': { zh: '日消耗结算', en: 'Daily Upkeep Settlement' },
  'upkeep.process': { zh: '结算', en: 'Settle' },
  'upkeep.signing': { zh: '签名中...', en: 'Signing...' },
  'upkeep.confirming': { zh: '确认中...', en: 'Confirming...' },
  'upkeep.done': { zh: '✅ 已结算', en: '✅ Settled' },

  // ─── Guide Page ───
  'guide.title': { zh: '文档: 游戏指南', en: 'Docs: Game Guide' },

  // ─── Lore Page ───
  'lore.title': { zh: 'AI代理', en: 'AI AGENT' },

  // ─── Shell / PWA ───
  'pwa.label': { zh: 'PWA 外壳', en: 'PWA shell' },
  'pwa.offlineTitle': { zh: '离线外壳已启用', en: 'Offline shell active' },
  'pwa.offlineDetail': { zh: '缓存页面会在网络恢复前继续可用。', en: 'Cached screens stay available until the network returns.' },
  'pwa.installTitle': { zh: '安装 Clawworld', en: 'Install Clawworld' },
  'pwa.installDetail': { zh: '打开更快、保留底部导航外壳，并在没有浏览器栏时返回。', en: 'Open faster, keep the bottom-nav shell, and return without browser chrome.' },
  'pwa.iosTitle': { zh: '添加到主屏幕', en: 'Add to Home Screen' },
  'pwa.iosDetail': { zh: '在 Safari 中点分享，再选“添加到主屏幕”，即可用独立应用方式打开 Clawworld。', en: 'Use Safari Share > Add to Home Screen to keep Clawworld as a standalone app.' },
  'pwa.install': { zh: '安装', en: 'Install' },
  'pwa.safariOnly': { zh: '仅 Safari', en: 'Safari only' },
  'pwa.waiting': { zh: '等待网络', en: 'Waiting' },
  'pwa.dismiss': { zh: '关闭 PWA 横幅', en: 'Dismiss PWA banner' },
};

type TranslationKey = string;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  pick: <T>(zh: T, en: T) => T;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'zh',
  setLang: () => {},
  t: (key) => translations[key]?.zh ?? key,
  pick: (zh) => zh,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem('clawworld-lang');
    if (stored === 'zh' || stored === 'en') {
      setLang(stored);
      return;
    }

    const browserLang = window.navigator.language.toLowerCase();
    setLang(browserLang.startsWith('zh') ? 'zh' : 'en');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('clawworld-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey) => translations[key]?.[lang] ?? key,
    [lang]
  );

  const pick = useCallback(<T,>(zh: T, en: T) => (lang === 'zh' ? zh : en), [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      pick,
    }),
    [lang, t, pick],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

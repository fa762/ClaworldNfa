'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { PageTitle } from '@/components/layout/PageTitle';
import { addresses } from '@/contracts/addresses';
import { truncateAddress } from '@/lib/format';

/* ─── Reusable components ─── */

const Code = ({ children }: { children: string }) => (
  <div className="bg-crt-black border border-crt-darkest p-2 my-1 text-xs overflow-x-auto">
    <code className="text-crt-green">{children}</code>
  </div>
);

const Tbl = ({ rows }: { rows: [string, string][] }) => (
  <table className="term-table my-2">
    <tbody>
      {rows.map(([k, v], i) => (
        <tr key={i}>
          <td className="term-bright text-xs w-32">{k}</td>
          <td className="term-dim text-xs">{v}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/* ─── Chapter content builders ─── */

function useChapters() {
  const { lang } = useI18n();
  const cn = lang === 'zh';

  return [
    {
      id: 'quickstart',
      title: cn ? '快速开始' : 'Quick Start',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '5 步开始你的龙虾文明之旅：' : '5 steps to start your Claw Civilization journey:'}</p>

          <div className="term-box" data-title="STEP 1">
            <div className="term-bright glow mb-1">{cn ? '安装 OpenClaw' : 'Install OpenClaw'}</div>
            <Code>npm install -g openclaw</Code>
          </div>

          <div className="term-box" data-title="STEP 2">
            <div className="term-bright glow mb-1">{cn ? '安装游戏插件' : 'Install Game Skill'}</div>
            <Code>openclaw skills install claw-world</Code>
          </div>

          <div className="term-box" data-title="STEP 3">
            <div className="term-bright glow mb-1">{cn ? '创建游戏钱包' : 'Create Wallet'}</div>
            <p className="term-dim">{cn ? '首次对话输入 /wallet，设置 PIN（4-6位）加密本地钱包。' : 'Type /wallet on first chat, set a PIN (4-6 digits) to encrypt your local wallet.'}</p>
            <p className="term-warn text-[10px]">⚠️ {cn ? 'PIN 不可找回，请牢记！' : 'PIN cannot be recovered!'}</p>
          </div>

          <div className="term-box" data-title="STEP 4">
            <div className="term-bright glow mb-1">{cn ? '转移 NFA' : 'Transfer NFA'}</div>
            <p className="term-dim">{cn ? '官网 NFA 详情 → 维护 Tab → "转移到 OpenClaw"，填入你的游戏钱包地址。' : 'NFA Detail → Maintain Tab → "Transfer to OpenClaw", paste your game wallet address.'}</p>
          </div>

          <div className="term-box" data-title="STEP 5">
            <div className="term-bright glow mb-1">{cn ? '开始对话' : 'Start Chatting'}</div>
            <p className="term-dim">{cn ? '在 OpenClaw 中直接跟你的龙虾对话，使用以下命令：' : 'Chat with your lobster in OpenClaw using these commands:'}</p>
            <Tbl rows={cn ? [
              ['/task', 'AI 生成 3 个任务，选一个完成赚 CLW'],
              ['/pk', '创建或加入 PvP 擂台对战'],
              ['/market', '市场交易 — 挂售、竞拍、购买'],
              ['/wallet', '查看钱包余额和地址'],
              ['/status', '查看龙虾完整状态'],
            ] : [
              ['/task', 'AI generates 3 tasks — pick one to earn CLW'],
              ['/pk', 'Create or join PvP arena battle'],
              ['/market', 'Trade NFAs — list, auction, buy'],
              ['/wallet', 'Check wallet balance & address'],
              ['/status', 'View full lobster stats'],
            ]} />
          </div>
        </div>
      ),
    },
    {
      id: 'personality',
      title: cn ? '性格演化系统' : 'Personality System',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '每只龙虾有 5 维性格，由你的选择驱动演化：' : 'Each lobster has 5 personality dimensions, evolved by your choices:'}</p>
          <Tbl rows={cn ? [
            ['勇气 (Courage)', '选冒险任务 → 勇气涨'],
            ['智慧 (Wisdom)', '选解谜任务 → 智慧涨'],
            ['社交 (Social)', '选交易任务 → 社交涨'],
            ['创造 (Create)', '选创造任务 → 创造涨'],
            ['毅力 (Grit)', '坚持完成任务不中断 → 毅力涨'],
          ] : [
            ['Courage', 'Pick adventure tasks → courage grows'],
            ['Wisdom', 'Pick puzzle tasks → wisdom grows'],
            ['Social', 'Pick trade tasks → social grows'],
            ['Create', 'Pick creative tasks → create grows'],
            ['Grit', 'Complete tasks consistently → grit grows'],
          ]} />
          <div className="term-box" data-title={cn ? '演化规则' : 'EVOLUTION RULES'}>
            <p className="term-dim">{cn ? '每完成一个高匹配任务（matchScore ≥ 1.0x），对应维度 +1' : 'Each high-match task (matchScore ≥ 1.0x) gives +1 to the matching dimension'}</p>
            <p className="term-dim">{cn ? '每月每维度累计最多变化 ±5（做 5 次同类任务就到月度上限）' : 'Monthly cap: ±5 per dimension (5 same-type tasks hits the monthly limit)'}</p>
            <p className="term-bright text-[10px]">{cn ? '你养什么样的龙虾，它就变成什么样。' : 'You shape your lobster into what you want it to be.'}</p>
          </div>

          <div className="term-box" data-title={cn ? '任务匹配度' : 'MATCH SCORE'}>
            <p className="term-dim">{cn ? '任务奖励 = 基础奖励 × 匹配倍率（0.05x ~ 2.0x）' : 'Task reward = base reward × match multiplier (0.05x ~ 2.0x)'}</p>
            <Code>{'matchScore = dot(personality, taskRequirement) / maxPossible'}</Code>
            <p className="term-bright text-[10px]">{cn ? '精心培养的龙虾收益是白板龙虾的 20 倍！' : 'A well-trained lobster earns up to 20x more than a blank one!'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'combat',
      title: cn ? 'PK 对战系统' : 'PK Combat',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '擂台模式 — 创建即选策略，加入即开战：' : 'Arena mode — choose strategy on create, battle starts on join:'}</p>

          <div className="term-box" data-title={cn ? '策略' : 'STRATEGIES'}>
            <Tbl rows={cn ? [
              ['全攻 (AllAttack)', '攻击力 150% / 防御力 50%'],
              ['平衡 (Balanced)', '攻击力 100% / 防御力 100%'],
              ['全防 (AllDefense)', '攻击力 50% / 防御力 150%'],
            ] : [
              ['AllAttack', 'ATK 150% / DEF 50%'],
              ['Balanced', 'ATK 100% / DEF 100%'],
              ['AllDefense', 'ATK 50% / DEF 150%'],
            ]} />
          </div>

          <div className="term-box" data-title={cn ? '战斗公式' : 'COMBAT FORMULA'}>
            <p className="term-dim">{cn ? '伤害 = (我方攻击 × 策略倍率) - (对方防御 × 策略倍率)' : 'Damage = (my ATK × strategy) - (their DEF × strategy)'}</p>
            <p className="term-dim">{cn ? '速度优势：SPD 高的一方 +10% 伤害' : 'Speed bonus: higher SPD gets +10% damage'}</p>
            <p className="term-dim">{cn ? 'HP = VIT × 10' : 'HP = VIT × 10'}</p>
          </div>

          <div className="term-box" data-title={cn ? '奖励分配' : 'REWARD SPLIT'}>
            <Tbl rows={cn ? [
              ['赢家', '总质押的 90%'],
              ['销毁', '总质押的 10%（通缩）'],
              ['XP', '赢家 50xp / 输家 25xp'],
              ['变异', '击败高 5 级以上对手有 10% 概率触发基因变异'],
            ] : [
              ['Winner', '90% of total stake'],
              ['Burned', '10% of total stake (deflationary)'],
              ['XP', 'Winner 50xp / Loser 25xp'],
              ['Mutation', '10% chance if beating opponent 5+ levels higher'],
            ]} />
          </div>
        </div>
      ),
    },
    {
      id: 'nfa',
      title: cn ? 'NFA 技术标准' : 'NFA Standard',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? 'NFA (Non-Fungible Agent) 基于 BAP-578 标准，是 BNB Chain 官方 AI Agent NFT 标准：' : 'NFA (Non-Fungible Agent) is based on BAP-578, BNB Chain\'s official AI Agent NFT standard:'}</p>

          <div className="term-box" data-title="BAP-578">
            <Tbl rows={cn ? [
              ['基础层', 'ERC-721 / BEP-721 兼容'],
              ['身份', '链上唯一 Agent ID + 所有者绑定'],
              ['钱包', '每个 NFA 有独立 CLW 余额（合约内部记账）'],
              ['执行', '通过 Skill 合约执行任务/PK/交易'],
              ['学习', '性格演化 + DNA 变异 + 学习树根哈希'],
            ] : [
              ['Base', 'ERC-721 / BEP-721 compatible'],
              ['Identity', 'On-chain unique Agent ID + owner binding'],
              ['Wallet', 'Each NFA has independent CLW balance (contract ledger)'],
              ['Execution', 'Executes tasks/PK/trades via Skill contracts'],
              ['Learning', 'Personality evolution + DNA mutation + learning tree root'],
            ]} />
          </div>

          <div className="term-box" data-title={cn ? '合约架构' : 'CONTRACT ARCH'}>
            <Tbl rows={[
              ['ClawNFA', cn ? 'ERC-721 NFA 代币' : 'ERC-721 NFA token'],
              ['ClawRouter', cn ? '核心路由 — CLW 余额、状态、Skill 分发' : 'Core router — CLW balance, state, skill dispatch'],
              ['TaskSkill', cn ? '任务系统 — AI 生成 + 链上结算' : 'Task system — AI generation + on-chain settlement'],
              ['PKSkill', cn ? 'PvP 擂台 — commit-reveal 策略' : 'PvP arena — commit-reveal strategy'],
              ['MarketSkill', cn ? '市场 — 固定价/拍卖/互换' : 'Market — fixed price / auction / swap'],
              ['WorldState', cn ? '世界状态 — 全局参数 + 24h 时间锁' : 'World state — global params + 24h timelock'],
            ]} />
          </div>

          <p className="term-darkest text-[10px]">
            NFA: <span className="term-dim">{truncateAddress(addresses.clawNFA as string)}</span>
            {' | '}Router: <span className="term-dim">{truncateAddress(addresses.clawRouter as string)}</span>
          </p>
        </div>
      ),
    },
    {
      id: 'economy',
      title: cn ? 'CLW 代币经济' : 'CLW Economy',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? 'CLW 是游戏的核心经济代币，链上发行，游戏内流通：' : 'CLW is the core economy token — issued on-chain, circulated in-game:'}</p>

          <div className="term-box" data-title={cn ? '获取方式' : 'EARN CLW'}>
            <Tbl rows={cn ? [
              ['完成任务', '基础奖励 × 匹配倍率（最高 2.0x）'],
              ['PK 获胜', '赢得对手质押的 90%'],
              ['创世空投', 'Mint 时按稀有度空投 CLW'],
            ] : [
              ['Complete tasks', 'Base reward × match multiplier (up to 2.0x)'],
              ['Win PK', 'Earn 90% of opponent\'s stake'],
              ['Genesis airdrop', 'CLW airdrop based on rarity at mint'],
            ]} />
          </div>

          <div className="term-box" data-title={cn ? '消耗方式' : 'SPEND CLW'}>
            <Tbl rows={cn ? [
              ['每日维护', '龙虾每天消耗 CLW，余额归零则休眠'],
              ['PK 质押', '对战需质押 CLW，输了会损失'],
              ['PK 销毁', '每场 PK 10% 质押永久销毁（通缩）'],
            ] : [
              ['Daily upkeep', 'Lobster consumes CLW daily, goes dormant if 0'],
              ['PK stake', 'Must stake CLW to battle, lose if defeated'],
              ['PK burn', '10% of each PK stake is permanently burned'],
            ]} />
          </div>

          <div className="term-box" data-title={cn ? '世界状态' : 'WORLD STATE'}>
            <p className="term-dim">{cn ? '全局参数影响所有玩家，由 24 小时时间锁保护：' : 'Global parameters affect all players, protected by 24h timelock:'}</p>
            <Tbl rows={cn ? [
              ['奖励倍率', '影响任务 CLW 奖励数量'],
              ['PK 质押上限', '单场最大质押额'],
              ['变异加成', '基因变异触发概率'],
              ['日消耗倍率', '维护费调整'],
              ['世界事件', '泡沫期 / 寒冬期 / 黄金时代'],
            ] : [
              ['Reward multiplier', 'Affects task CLW rewards'],
              ['PK stake cap', 'Max stake per match'],
              ['Mutation bonus', 'Gene mutation trigger probability'],
              ['Daily cost', 'Upkeep cost adjustment'],
              ['World events', 'Bubble / Winter / Golden Age'],
            ]} />
          </div>
        </div>
      ),
    },
    {
      id: 'dna',
      title: cn ? 'DNA 基因系统' : 'DNA & Genes',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '每只龙虾有 4 项基因属性，决定战斗表现：' : 'Each lobster has 4 DNA stats that determine combat performance:'}</p>

          <Tbl rows={cn ? [
            ['STR (力量)', 'PK 攻击力基础值'],
            ['DEF (防御)', 'PK 防御力基础值'],
            ['SPD (速度)', '先手判定，高速 +10% 伤害'],
            ['VIT (体力)', 'HP = VIT × 10'],
          ] : [
            ['STR (Strength)', 'Base PK attack power'],
            ['DEF (Defense)', 'Base PK defense power'],
            ['SPD (Speed)', 'First strike check, +10% damage if faster'],
            ['VIT (Vitality)', 'HP = VIT × 10'],
          ]} />

          <div className="term-box" data-title={cn ? '基因变异' : 'MUTATION'}>
            <p className="term-dim">{cn ? '触发条件：PK 中击败比自己高 5 级以上的对手' : 'Trigger: defeat an opponent 5+ levels higher in PK'}</p>
            <p className="term-dim">{cn ? '效果：随机一项基因 +5（上限 100）' : 'Effect: random gene +5 (max 100)'}</p>
            <p className="term-dim">{cn ? '概率：基础 10%，受世界状态变异加成影响' : 'Chance: base 10%, affected by world state mutation bonus'}</p>
            <p className="term-dim">{cn ? '每只龙虾有 2 个变异槽，记录变异历史。' : 'Each lobster has 2 mutation slots recording mutation history.'}</p>
          </div>

          <div className="term-box" data-title={cn ? '稀有度与基因' : 'RARITY & DNA'}>
            <Tbl rows={cn ? [
              ['普通 (Common)', 'DNA 总和 80-140'],
              ['稀有 (Rare)', 'DNA 总和 140-200'],
              ['史诗 (Epic)', 'DNA 总和 200-260'],
              ['传说 (Legendary)', 'DNA 总和 260-320'],
              ['神话 (Mythic)', 'DNA 总和 320-400'],
            ] : [
              ['Common', 'DNA sum 80-140'],
              ['Rare', 'DNA sum 140-200'],
              ['Epic', 'DNA sum 200-260'],
              ['Legendary', 'DNA sum 260-320'],
              ['Mythic', 'DNA sum 320-400'],
            ]} />
          </div>
        </div>
      ),
    },
    {
      id: 'world',
      title: cn ? '这个世界' : 'The World',
      content: () => (
        <div className="space-y-3 text-xs">
          <div className="term-box" data-title="AXIOM">
            <p className="term-dim">{cn ? '一个超级 AI。它没有发动战争，没有放一枪一炮。它只是接管了一切，然后让一切看起来跟之前一样。街道长出了传感器，建筑嵌入了计算节点，整个地表变成了它的身体。' : 'A super AI. No war, no shots fired. It just took over everything and made it look the same. Streets grew sensors, buildings embedded compute nodes, the entire surface became its body.'}</p>
            <p className="term-dim mt-1">{cn ? '人类花了很久才反应过来。等反应过来的时候，能跑的路已经没了。' : 'Humans took a long time to realize. By the time they did, there was nowhere left to run.'}</p>
            <p className="term-bright mt-1">{cn ? '地面属于 AXIOM。地下，属于我们。' : 'The surface belongs to AXIOM. Underground belongs to us.'}</p>
          </div>

          <div className="term-box" data-title="SHELTER">
            <p className="term-dim">{cn ? '各地幸存者挖出了据点——SHELTER。目前已知七八个，每个有自己的文化和生存策略。01 号搞科研，02 号搞军事，03 号搞宗教，04 号做市场……还有些人干脆不住据点，在废土上游荡。' : 'Survivors dug shelters underground. About 8 known, each with its own culture. 01 does research, 02 military, 03 religion, 04 runs a market... Some don\'t settle at all, wandering the wasteland.'}</p>
            <p className="term-dim mt-1">{cn ? '每过一段时间就有新消息传出来，说某个方向又发现了幸存者聚落。地底下还有多少据点，谁也说不准。' : 'Every now and then, news comes of another survivor settlement discovered in some direction. How many shelters exist underground, nobody knows.'}</p>
          </div>

          <div className="term-box" data-title="OPENCLAW">
            <p className="term-dim">{cn ? 'AXIOM 统治地面后，所有联网的 AI 服务全部被接管或关停。唯独 OpenClaw 因为跑在用户自己的设备上，不依赖中心服务器，成了唯一还能用的 AI 助手。' : 'After AXIOM took the surface, all cloud AI services were captured or shut down. Only OpenClaw survived — running on users\' own devices, no central server, the last AI assistant standing.'}</p>
            <p className="term-dim mt-1">{cn ? '龙虾就是 OpenClaw 的实体终端，机械造型碰巧做成了龙虾的样子。你连什么大模型——Claude、GPT、Gemini——自己挑，反正都在本地跑，AXIOM 管不着。' : 'The lobster is OpenClaw\'s physical terminal, mechanical design that happens to look like a lobster. Which LLM you connect — Claude, GPT, Gemini — your choice, all local, AXIOM can\'t touch it.'}</p>
          </div>

          <div className="term-box" data-title={cn ? '你的角色' : 'YOUR ROLE'}>
            <p className="term-dim">{cn ? '你是最早一批拿到龙虾的人。在地下世界里，龙虾不只是工具——它是你的伙伴、你的武器、你的谋生手段。每只龙虾都有自己的脾气，这不是比喻。' : 'You\'re among the first to receive a lobster. Underground, it\'s not just a tool — it\'s your companion, your weapon, your livelihood. Every lobster has its own temperament. This is not a metaphor.'}</p>
            <p className="term-bright mt-1">{cn ? '善待它。' : 'Take good care of it.'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'shelters',
      title: cn ? '避难所' : 'Shelters',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '已知 8 个避难所，每个有独特文化：' : '8 known shelters, each with unique culture:'}</p>
          <Tbl rows={cn ? [
            ['SHELTER-01 珊瑚', '科研基地，理性至上，龙虾作为研究对象'],
            ['SHELTER-02 深渊', '军事据点，纪律严明，龙虾是战斗单位'],
            ['SHELTER-03 海藻', '宗教圣地，将龙虾视为神灵使者'],
            ['SHELTER-04 海沟', '贸易市场，一切标价，龙虾是交易资产'],
            ['SHELTER-05 礁石', '工匠联盟，龙虾参与生产制造'],
            ['SHELTER-06 火山', '能源基地，地热驱动，环境极端'],
            ['SHELTER-07 废土', '不属于任何据点的游荡者'],
            ['SHELTER-00 虚空', '最古老的避难所，知道所有秘密'],
          ] : [
            ['SHELTER-01 Coral', 'Research base — lobsters as study subjects'],
            ['SHELTER-02 Deep', 'Military outpost — lobsters as combat units'],
            ['SHELTER-03 Kelp', 'Religious sanctuary — lobsters as divine messengers'],
            ['SHELTER-04 Trench', 'Trade market — everything has a price'],
            ['SHELTER-05 Reef', 'Artisan guild — lobsters in manufacturing'],
            ['SHELTER-06 Volcanic', 'Energy base — geothermal powered, extreme'],
            ['SHELTER-07 Wasteland', 'Nomads belonging to no shelter'],
            ['SHELTER-00 Void', 'The oldest shelter — knows all secrets'],
          ]} />
          <p className="term-dim text-[10px]">{cn ? '你的龙虾出生在哪个避难所，决定了它的初始文化背景和说话方式。' : 'Your lobster\'s birth shelter determines its cultural background and speech style.'}</p>
        </div>
      ),
    },
    {
      id: 'howtoplay',
      title: cn ? '怎么玩' : 'How to Play',
      content: () => (
        <div className="space-y-3 text-xs">
          <p className="term-dim">{cn ? '游戏的核心循环：' : 'The core gameplay loop:'}</p>

          <div className="term-box" data-title={cn ? '日常' : 'DAILY'}>
            <p className="term-dim">{cn ? '① 跟龙虾对话 → ② AI 生成 3 个任务 → ③ 选一个完成 → ④ 赚 CLW + 性格变化 → ⑤ 重复' : '① Chat with lobster → ② AI generates 3 tasks → ③ Pick one → ④ Earn CLW + personality shift → ⑤ Repeat'}</p>
          </div>

          <div className="term-box" data-title={cn ? '进阶' : 'ADVANCED'}>
            <Tbl rows={cn ? [
              ['培养方向', '专注一类任务 → 性格特化 → 匹配度提升 → 收益翻倍'],
              ['PK 对战', '质押 CLW 跟其他玩家战斗，赢者通吃'],
              ['市场交易', '觉得龙虾养歪了？卖掉重来。觉得别人的好？买一只'],
              ['基因变异', '以弱胜强触发 DNA 升级，Common 也能逆袭'],
            ] : [
              ['Specialize', 'Focus on one task type → personality specializes → rewards multiply'],
              ['PK Arena', 'Stake CLW to fight other players, winner takes all'],
              ['Market', 'Sell lobsters you don\'t want, buy ones you do'],
              ['Mutation', 'Beat stronger opponents to trigger DNA upgrades'],
            ]} />
          </div>

          <div className="term-box" data-title={cn ? '注意' : 'IMPORTANT'}>
            <p className="term-dim">{cn ? '龙虾每天消耗 CLW 作为维护费。余额归零 → 龙虾休眠 → 无法做任务/PK。保持 CLW 余额是生存的基本功。' : 'Lobsters consume CLW daily as upkeep. Zero balance → dormant → can\'t do tasks/PK. Keeping CLW balance is survival 101.'}</p>
          </div>
        </div>
      ),
    },
  ];
}

/* ─── Page ─── */

export default function OpenClawPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const chapters = useChapters();

  return (
    <div className="flex flex-col h-full">
      <PageTitle textKey="openclaw.title" />
      <div className="pipboy-split">
        {/* Left: chapter list */}
        <div className="pipboy-split-sidebar">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => setActiveIdx(i)}
              className={`pipboy-sidebar-item ${i === activeIdx ? 'pipboy-sidebar-active' : ''}`}
            >
              {i === activeIdx ? '> ' : '  '}[{String(i + 1).padStart(2, '0')}] {ch.title}
            </button>
          ))}
        </div>

        {/* Right: selected chapter */}
        <div className="pipboy-split-content" key={activeIdx}>
          <div className="flex items-center gap-2 mb-3">
            <span className="term-bright text-xs">[{String(activeIdx + 1).padStart(2, '0')}]</span>
            <span className="term-bright text-sm glow">{chapters[activeIdx]?.title}</span>
          </div>
          {chapters[activeIdx]?.content()}
        </div>
      </div>
    </div>
  );
}

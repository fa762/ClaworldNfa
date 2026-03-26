'use client';

import { useI18n } from '@/lib/i18n';
import { PageTitle } from '@/components/layout/PageTitle';
import { addresses } from '@/contracts/addresses';
import { truncateAddress } from '@/lib/format';

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="term-box mb-3" data-title={`STEP ${n}`}>
    <div className="term-bright text-sm glow mb-2">{title}</div>
    <div className="text-xs space-y-2 term-dim">{children}</div>
  </div>
);

const Code = ({ children }: { children: string }) => (
  <div className="bg-crt-black border border-crt-darkest p-2 my-1 text-xs overflow-x-auto">
    <code className="text-crt-green">{children}</code>
  </div>
);

const CmdList = ({ cmds }: { cmds: { cmd: string; desc: string }[] }) => (
  <div className="space-y-1 mt-2">
    {cmds.map((c) => (
      <div key={c.cmd} className="flex gap-3">
        <span className="text-crt-green font-bold shrink-0">{c.cmd}</span>
        <span className="term-dim">— {c.desc}</span>
      </div>
    ))}
  </div>
);

export default function OpenClawPage() {
  const { lang } = useI18n();
  const cn = lang === 'zh';

  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle textKey="openclaw.title" />

      <div className="text-xs term-dim mb-4">
        {cn
          ? '> OpenClaw 是开源本地 AI 助手，龙虾在你的设备上运行，无需后端服务器。'
          : '> OpenClaw is an open-source local AI assistant. Your lobster runs on your device — no backend server needed.'}
      </div>

      {/* Step 1: Install OpenClaw */}
      <Step n={1} title={cn ? '安装 OpenClaw' : 'Install OpenClaw'}>
        <p>{cn ? '从 GitHub 下载最新版本：' : 'Download the latest release from GitHub:'}</p>
        <Code>{'npm install -g openclaw'}</Code>
        <p className="term-darkest">
          {cn ? '或访问 ' : 'Or visit '}
          <a href="https://github.com/openclaw-ai/openclaw" target="_blank" rel="noopener noreferrer" className="term-link">
            github.com/openclaw-ai/openclaw
          </a>
        </p>
      </Step>

      {/* Step 2: Install Claw World Skill */}
      <Step n={2} title={cn ? '安装 Claw World 游戏插件' : 'Install Claw World Skill'}>
        <p>{cn ? '一条命令安装游戏：' : 'One command to install the game:'}</p>
        <Code>{'openclaw skills install claw-world'}</Code>
        <p>{cn ? '验证安装：' : 'Verify installation:'}</p>
        <Code>{'openclaw skills list'}</Code>
        <p>{cn ? '应该看到 claw-world ✓ ready' : 'You should see claw-world ✓ ready'}</p>
      </Step>

      {/* Step 3: Create Wallet */}
      <Step n={3} title={cn ? '创建游戏钱包' : 'Create Game Wallet'}>
        <p>{cn ? '首次对话时，AI 会引导你创建本地加密钱包：' : 'On first chat, the AI guides you to create a local encrypted wallet:'}</p>
        <div className="bg-crt-black border border-crt-darkest p-2 my-1 text-xs">
          <div className="term-dim">{cn ? '你 >' : 'You >'} <span className="text-crt-green">/wallet</span></div>
          <div className="term-dim mt-1">{cn ? '龙虾 >' : 'Lobster >'} <span className="text-crt-bright">
            {cn ? '请设置 PIN 码（4-6位数字）来加密你的钱包 🔐' : 'Set a PIN (4-6 digits) to encrypt your wallet 🔐'}
          </span></div>
        </div>
        <p className="term-warn text-[10px] mt-1">
          ⚠️ {cn ? 'PIN 码不可找回，请牢记！钱包私钥 AES-256 加密存储在本地。' : 'PIN cannot be recovered. Wallet private key is AES-256 encrypted locally.'}
        </p>
      </Step>

      {/* Step 4: Transfer NFA */}
      <Step n={4} title={cn ? '转移 NFA 到 OpenClaw' : 'Transfer NFA to OpenClaw'}>
        <p>{cn ? '在本站 NFA 详情页 → 维护 Tab → "转移到 OpenClaw"' : 'On this site: NFA Detail → Maintain Tab → "Transfer to OpenClaw"'}</p>
        <div className="flex items-center gap-2 my-2">
          <span className="text-crt-green">{cn ? '官网 Mint' : 'Mint on Site'}</span>
          <span className="term-dim">→</span>
          <span className="text-crt-green">{cn ? '官网转移' : 'Transfer'}</span>
          <span className="term-dim">→</span>
          <span className="text-crt-bright glow">{cn ? 'OpenClaw 对话玩游戏' : 'Play in OpenClaw'}</span>
        </div>
        <p className="term-darkest text-[10px]">
          {cn ? 'NFA 合约：' : 'NFA Contract: '}
          <span className="text-crt-dim">{truncateAddress(addresses.clawNFA as string)}</span>
        </p>
      </Step>

      {/* Step 5: Play */}
      <Step n={5} title={cn ? '开始游戏' : 'Start Playing'}>
        <p>{cn ? '在 OpenClaw 对话框中使用以下命令：' : 'Use these commands in OpenClaw chat:'}</p>
        <CmdList cmds={cn ? [
          { cmd: '/task', desc: 'AI 生成 3 个任务，选一个完成赚 CLW' },
          { cmd: '/pk', desc: '创建或加入 PvP 对战，质押 CLW 一决高下' },
          { cmd: '/market', desc: '市场交易 — 挂售、竞拍、购买 NFA' },
          { cmd: '/wallet', desc: '查看钱包余额和地址' },
          { cmd: '/status', desc: '查看龙虾状态、性格、基因' },
        ] : [
          { cmd: '/task', desc: 'AI generates 3 tasks — pick one to earn CLW' },
          { cmd: '/pk', desc: 'Create or join PvP arena — stake CLW to battle' },
          { cmd: '/market', desc: 'Trade NFAs — list, auction, or buy' },
          { cmd: '/wallet', desc: 'Check wallet balance and address' },
          { cmd: '/status', desc: 'View lobster stats, personality, DNA' },
        ]} />
      </Step>

      {/* Tips */}
      <div className="term-box mt-4" data-title={cn ? '提示' : 'TIPS'}>
        <div className="text-[11px] space-y-1">
          <div className="flex gap-2">
            <span className="term-bright">[1]</span>
            <span className="term-dim">{cn ? '性格由你的选择决定 — 选冒险任务 → 勇气涨，选解谜 → 智慧涨' : 'Personality is driven by your choices — adventure tasks raise courage, puzzle tasks raise wisdom'}</span>
          </div>
          <div className="flex gap-2">
            <span className="term-bright">[2]</span>
            <span className="term-dim">{cn ? '任务匹配度 = 性格向量 · 需求向量，精心培养的龙虾奖励可达 20 倍' : 'Task match score = personality · requirement vector — a trained lobster earns up to 20x rewards'}</span>
          </div>
          <div className="flex gap-2">
            <span className="term-bright">[3]</span>
            <span className="term-dim">{cn ? 'PK 策略：全攻(150%攻/50%防)、平衡(100%/100%)、全防(50%攻/150%防)' : 'PK strategies: AllAttack(150%/50%), Balanced(100%/100%), AllDefense(50%/150%)'}</span>
          </div>
          <div className="flex gap-2">
            <span className="term-bright">[4]</span>
            <span className="term-dim">{cn ? '每日维护费 — 保持龙虾 CLW 余额 > 0，否则会休眠' : 'Daily upkeep — keep CLW balance > 0 or your lobster goes dormant'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

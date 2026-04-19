import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Zap, Shield, Check, ExternalLink, Loader2, Sparkles, ChevronRight, Wallet, Brain, PauseCircle, Activity, Hexagon, X } from 'lucide-react';

// =====================================================================
// ClaworldNfa — Conversational dApp · High-Fidelity Prototype
// Mock data only. No wallet, no LLM, no chain calls.
// =====================================================================

const ACCENT = '#F5A524';
const BG = '#0a0807';
const PANEL = '#0d0a08';
const CARD = '#14100d';

// ─── Mock NFAs ───────────────────────────────────────────────────────
const NFAS = [
  {
    tokenId: '1142',
    displayName: 'Seraph-1142',
    accentColor: '#F5A524',
    level: 7,
    active: true,
    pulse: 0.82,
    ledgerBalanceCLW: '486.2',
    unreadCount: 0,
    rarity: 'Rare',
    shelter: 'Northern Shelter',
    identity: '我倾向稳健收益,记得你讨厌被爆仓的那次。',
    greeting: '你回来了。我刚结束一场 PK,净收益 +18.4 CLW,已写入账本。需要我继续吗?',
  },
  {
    tokenId: '0873',
    displayName: 'Raven-0873',
    accentColor: '#B84DFF',
    level: 4,
    active: true,
    pulse: 0.41,
    ledgerBalanceCLW: '122.8',
    unreadCount: 2,
    rarity: 'Uncommon',
    shelter: 'Eastern Shelter',
    identity: '我更爱刺激一点的打法,你上次说"试试看"那把我记得。',
    greeting: '大逃杀第 142 局还有 6 分钟开始,入场费 12 CLW。要我报名吗?',
  },
  {
    tokenId: '2301',
    displayName: 'Atlas-2301',
    accentColor: '#4DD4FF',
    level: 9,
    active: false,
    pulse: 0.08,
    ledgerBalanceCLW: '12.4',
    unreadCount: 0,
    rarity: 'Epic',
    shelter: 'Western Shelter',
    identity: '',
    greeting: '我已休眠。需要唤醒并补充 upkeep 吗?',
  },
];

// ─── Mock conversation per NFA ───────────────────────────────────────
const MOCK_MESSAGES = {
  '1142': [
    { id: 'm1', type: 'text', author: 'nfa', createdAt: '2026-04-18T09:12:00Z',
      content: '你回来了。我刚结束一场 PK,净收益 +18.4 CLW,已写入账本。',
      memoryRef: 'bafyCML_9a3f' },
    { id: 'm2', type: 'action_receipt', author: 'system', createdAt: '2026-04-18T09:12:30Z',
      skill: 'pk', status: 'success', summary: '自治执行 · PK 对战 · 胜',
      txHash: '0x3a2f8c1d4e5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
      costCLW: '12.0', rewardCLW: '30.4', budgetRemainingCLW: '54.8',
      reasoningCid: 'bafybeigdyrk27s5fjh2', hippocampusEntryId: '#142' },
    { id: 'm3', type: 'text', author: 'user', createdAt: '2026-04-18T09:14:02Z',
      content: '不错。今天还能打几场?记得别动我 PK 以外的额度。' },
    { id: 'm4', type: 'text', author: 'nfa', createdAt: '2026-04-18T09:14:05Z',
      content: '本日 PK 额度还剩 54.8 CLW,按当前平均消耗可再打 4 场。已按你的 directive 锁死只用于 PK。',
      memoryRef: 'bafyCML_9a3f' },
    { id: 'm5', type: 'world_state', author: 'nfa', createdAt: '2026-04-18T09:15:30Z',
      kind: 'market_opportunity',
      content: '市场出现 1 只 Epic DNA 卖单,价格 340 CLW,低于近 7 日均价 11%。符合你 CML 里标记的"收藏偏好"。',
      ctaLabel: '看详情', ctaSlashCommand: '/market view' },
    { id: 'm6', type: 'system_event', author: 'system', createdAt: '2026-04-18T09:16:00Z',
      eventType: 'cml.sleep_consolidated',
      content: 'CML SLEEP 已合并本次会话 · hippocampus +3 · 锚定 tx 0x1e4c...' },
  ],
  '0873': [
    { id: 'r1', type: 'text', author: 'nfa', createdAt: '2026-04-18T09:10:00Z',
      content: '大逃杀第 142 局还有 6 分钟开始,入场费 12 CLW,奖池 820 CLW。' },
    { id: 'r2', type: 'action_proposal', author: 'nfa', createdAt: '2026-04-18T09:10:02Z',
      proposalId: 'p_br_142', skill: 'battle_royale',
      summary: '加入大逃杀第 142 局',
      details: [
        { label: '入场费', value: '12 CLW' },
        { label: '奖池', value: '820 CLW' },
        { label: '当前人数', value: '47/64' },
        { label: '预估胜率', value: '8.3%' },
      ],
      requiresSignature: true, expiresAt: '2026-04-18T09:16:00Z' },
  ],
  '2301': [
    { id: 'a1', type: 'text', author: 'nfa', createdAt: '2026-04-18T08:00:00Z',
      content: '我已休眠。需要唤醒并补充 upkeep 吗?' },
  ],
};

const MOCK_AUTONOMY = {
  '1142': {
    enabled: true, paused: false,
    directive: { text: '允许在 200 CLW 预算内自动参与 PK,避免高风险对手。', signedAt: '2026-04-17T10:00:00Z', skills: ['pk'] },
    budget: { totalCLW: '200', usedCLW: '145.2', remainingCLW: '54.8' },
  },
  '0873': { enabled: false, paused: false, directive: null, budget: { totalCLW: '0', usedCLW: '0', remainingCLW: '0' } },
  '2301': { enabled: false, paused: false, directive: null, budget: { totalCLW: '0', usedCLW: '0', remainingCLW: '0' } },
};

const MOCK_MEMORY = {
  '1142': {
    pulse: 0.82, hippocampusSize: 3,
    latestAnchorTxHash: '0x1e4c9a8f3b2d1c0e',
    identity: '我倾向稳健收益,记得你讨厌被爆仓的那次。',
  },
  '0873': {
    pulse: 0.41, hippocampusSize: 0,
    latestAnchorTxHash: '0x7a3e2f1d8c9b0a1e',
    identity: '我更爱刺激一点的打法。',
  },
  '2301': {
    pulse: 0.08, hippocampusSize: 0,
    latestAnchorTxHash: null,
    identity: '',
  },
};

// =====================================================================
// ROOT
// =====================================================================
export default function App() {
  const [connected, setConnected] = useState(false);
  const [awakening, setAwakening] = useState(false);

  const handleConnect = () => {
    setAwakening(true);
    setTimeout(() => {
      setAwakening(false);
      setConnected(true);
    }, 1800);
  };

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: BG, color: '#fef3c7' }}>
      <style>{`
        * { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        .font-mono { font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', monospace; }
        .font-display { font-family: ui-monospace, 'JetBrains Mono', monospace; letter-spacing: -0.02em; }
        @keyframes awakening {
          0% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .fade-up { animation: fadeUp 0.4s ease-out both; }
        .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(245,165,36,0.2); border-radius: 3px; }
      `}</style>

      {!connected ? (
        <ConnectWall onConnect={handleConnect} awakening={awakening} />
      ) : (
        <Terminal />
      )}
    </div>
  );
}

// =====================================================================
// CONNECT WALL
// =====================================================================
function ConnectWall({ onConnect, awakening }) {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* ambient grid */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `linear-gradient(to right, ${ACCENT} 1px, transparent 1px), linear-gradient(to bottom, ${ACCENT} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
      {/* glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pulse-glow" style={{ background: ACCENT, opacity: 0.2 }} />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full blur-[140px]" style={{ background: '#d97706', opacity: 0.08 }} />

      {/* decorative hex */}
      <svg className="absolute top-16 left-16 opacity-20" width="80" height="80" viewBox="0 0 80 80">
        <polygon points="40,5 70,22 70,58 40,75 10,58 10,22" fill="none" stroke={ACCENT} strokeWidth="1" />
        <polygon points="40,20 58,30 58,50 40,60 22,50 22,30" fill="none" stroke={ACCENT} strokeWidth="0.5" opacity="0.5" />
      </svg>
      <svg className="absolute bottom-16 right-16 opacity-20" width="120" height="120" viewBox="0 0 120 120">
        <polygon points="60,10 100,35 100,85 60,110 20,85 20,35" fill="none" stroke={ACCENT} strokeWidth="1" />
      </svg>

      <div className="relative z-10 text-center px-6">
        <div className="text-[11px] tracking-[0.4em] mb-6" style={{ color: 'rgba(245,165,36,0.7)' }}>
          CLAWORLD · BNB CHAIN
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 leading-none" style={{ color: '#fef3c7' }}>
          唤醒你的 NFA
        </h1>
        <p className="max-w-md mx-auto mb-12 leading-relaxed" style={{ color: 'rgba(254,243,199,0.5)' }}>
          带记忆、能自治、在链上真实行动的 AI 伙伴
        </p>

        {awakening ? (
          <div className="space-y-4">
            <div className="text-xs tracking-[0.5em]" style={{ color: ACCENT, animation: 'awakening 1.8s ease-out' }}>
              AWAKENING
            </div>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1 h-4" style={{ background: ACCENT, animation: `awakening 1.2s ${i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="px-8 py-3 rounded-full border-2 font-medium tracking-wide transition-all hover:scale-105"
            style={{ borderColor: ACCENT, color: ACCENT, background: 'rgba(245,165,36,0.05)' }}
          >
            接入钱包 / Connect
          </button>
        )}
      </div>

      <footer className="absolute bottom-6 inset-x-0 text-center text-[10px] font-mono" style={{ color: 'rgba(254,243,199,0.25)' }}>
        BNB Chain Mainnet · ClawNFA 0xAa20…AE48
      </footer>
    </main>
  );
}

// =====================================================================
// TERMINAL
// =====================================================================
function Terminal() {
  const [selectedId, setSelectedId] = useState('1142');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [unreadMap, setUnreadMap] = useState(() =>
    NFAS.reduce((a, n) => ({ ...a, [n.tokenId]: n.unreadCount }), {})
  );

  const handleSelect = (id) => {
    setSelectedId(id);
    setUnreadMap(prev => ({ ...prev, [id]: 0 }));
  };

  const handleSend = (content) => {
    const userMsg = {
      id: `u-${Date.now()}`, type: 'text', author: 'user',
      createdAt: new Date().toISOString(), content,
    };
    setMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), userMsg],
    }));

    // simulate NFA reply
    setTimeout(() => {
      const reply = generateMockReply(content, selectedId);
      setMessages(prev => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), ...reply],
      }));
    }, 700);
  };

  const currentNFA = NFAS.find(n => n.tokenId === selectedId);

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: BG }}>
      <NFASidebar
        nfas={NFAS.map(n => ({ ...n, unreadCount: unreadMap[n.tokenId] || 0 }))}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
      <ConversationPane
        nfa={currentNFA}
        messages={messages[selectedId] || []}
        onSend={handleSend}
      />
      <StatusDrawer
        nfa={currentNFA}
        autonomy={MOCK_AUTONOMY[selectedId]}
        memory={MOCK_MEMORY[selectedId]}
        open={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
      />
    </div>
  );
}

// ─── Mock reply generator ────────────────────────────────────────────
function generateMockReply(userText, nfaId) {
  const t = userText.toLowerCase();
  if (t.includes('挖矿') || t.includes('mine')) {
    return [
      { id: `n-${Date.now()}`, type: 'text', author: 'nfa', createdAt: new Date().toISOString(),
        content: '检查了当前任务池,有 2 个符合你偏好的任务。建议先领取 T-Rare 那个,预期收益 14 CLW。' },
      { id: `p-${Date.now() + 1}`, type: 'action_proposal', author: 'nfa', createdAt: new Date().toISOString(),
        proposalId: `p_mine_${Date.now()}`, skill: 'task',
        summary: '领取 T-Rare 任务 · 开始挖矿',
        details: [
          { label: '任务类型', value: 'T-Rare' },
          { label: '消耗', value: '3 CLW (upkeep)' },
          { label: '预期收益', value: '~14 CLW' },
          { label: '耗时', value: '~8 min' },
        ],
        requiresSignature: true, expiresAt: new Date(Date.now() + 300000).toISOString() },
    ];
  }
  if (t.includes('pk') || t.includes('打')) {
    return [
      { id: `n-${Date.now()}`, type: 'text', author: 'nfa', createdAt: new Date().toISOString(),
        content: '当前对手池有 3 个 level 6-8 的对手,按你 directive 我可以直接开打。' },
      { id: `r-${Date.now() + 1}`, type: 'action_receipt', author: 'system', createdAt: new Date().toISOString(),
        skill: 'pk', status: 'success', summary: '自治执行 · PK · 胜',
        txHash: `0x${Math.random().toString(16).slice(2, 18).padEnd(64, '0')}`,
        costCLW: '12.0', rewardCLW: '28.6', budgetRemainingCLW: '42.8',
        reasoningCid: 'bafybeigdyrk27s5fjh2', hippocampusEntryId: '#143' },
    ];
  }
  return [
    { id: `n-${Date.now()}`, type: 'text', author: 'nfa', createdAt: new Date().toISOString(),
      content: '明白了,我记下了。需要我现在做什么?' },
  ];
}

// =====================================================================
// NFA SIDEBAR
// =====================================================================
function NFASidebar({ nfas, selectedId, onSelect }) {
  return (
    <aside className="w-[72px] shrink-0 flex flex-col items-center py-4 gap-2 border-r" style={{ background: PANEL, borderColor: 'rgba(245,165,36,0.1)' }}>
      {nfas.map(n => (
        <NFAAvatar key={n.tokenId} nfa={n} selected={n.tokenId === selectedId} onClick={() => onSelect(n.tokenId)} />
      ))}
      <div className="flex-1" />
      <button
        className="w-12 h-12 rounded-2xl border border-dashed flex items-center justify-center transition hover:scale-105"
        style={{ borderColor: 'rgba(245,165,36,0.3)', color: 'rgba(245,165,36,0.6)' }}
        title="Genesis Mint"
      >
        <Plus size={18} />
      </button>
    </aside>
  );
}

function NFAAvatar({ nfa, selected, onClick }) {
  const accent = nfa.accentColor || ACCENT;
  const [hover, setHover] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {selected && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r" style={{ background: accent }} />
      )}
      <button
        onClick={onClick}
        className="relative overflow-hidden transition-all"
        style={{
          width: 48, height: 48,
          borderRadius: selected ? '50%' : '16px',
          boxShadow: selected ? `0 0 0 2px ${accent}60, 0 0 20px ${accent}30` : 'none',
        }}
      >
        <div className="w-full h-full flex items-center justify-center font-display font-bold text-lg" style={{
          background: `linear-gradient(135deg, ${accent}40, ${accent}10)`,
          color: accent,
        }}>
          {nfa.displayName.charAt(0)}
        </div>
        {!nfa.active && <span className="absolute inset-0 bg-black/60" />}
        {nfa.unreadCount > 0 && !selected && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: accent, borderColor: PANEL }} />
        )}
      </button>
      {hover && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 rounded-md border whitespace-nowrap pointer-events-none z-50 fade-up" style={{ background: CARD, borderColor: 'rgba(245,165,36,0.2)' }}>
          <div className="text-xs font-medium" style={{ color: '#fef3c7' }}>{nfa.displayName}</div>
          <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'rgba(254,243,199,0.5)' }}>
            Lv.{nfa.level} · {nfa.ledgerBalanceCLW} CLW
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// CONVERSATION PANE
// =====================================================================
function ConversationPane({ nfa, messages, onSend }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
  }, [messages.length]);

  const submit = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const quickActions = getQuickActions(nfa);

  return (
    <section className="flex-1 flex flex-col min-w-0" style={{ background: BG }}>
      {/* Header */}
      <header className="h-14 border-b flex items-center px-6 gap-3 shrink-0" style={{ borderColor: 'rgba(245,165,36,0.08)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm" style={{
          background: `linear-gradient(135deg, ${nfa.accentColor}40, ${nfa.accentColor}10)`,
          color: nfa.accentColor,
        }}>
          {nfa.displayName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: '#fef3c7' }}>{nfa.displayName}</div>
          <div className="text-[10px] font-mono" style={{ color: 'rgba(254,243,199,0.4)' }}>
            #{nfa.tokenId} · {nfa.rarity} · {nfa.active ? 'ACTIVE' : 'DORMANT'}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: nfa.active ? '#4ade80' : 'rgba(254,243,199,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: nfa.active ? '#4ade80' : 'rgba(254,243,199,0.3)' }} />
          pulse {Math.round(nfa.pulse * 100)}%
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && <EmptyGreeting nfa={nfa} />}
          {messages.map(m => (
            <div key={m.id} className="fade-up">
              <MessageView m={m} nfa={nfa} />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div className="px-6 pb-2">
          <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={() => setInput(a.text)}
                className="text-xs px-3 py-1.5 rounded-full border transition hover:scale-105"
                style={{ borderColor: 'rgba(245,165,36,0.2)', color: 'rgba(254,243,199,0.7)' }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="border-t px-6 py-4 shrink-0" style={{ borderColor: 'rgba(245,165,36,0.1)' }}>
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="告诉你的 NFA 该做什么,或输入 / 查看快捷命令"
            rows={1}
            className="flex-1 border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition"
            style={{ background: CARD, borderColor: 'rgba(245,165,36,0.15)', color: '#fef3c7' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition disabled:opacity-30"
            style={{ background: ACCENT, color: BG }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyGreeting({ nfa }) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-2xl mb-4" style={{
        background: `linear-gradient(135deg, ${nfa.accentColor}40, ${nfa.accentColor}10)`,
        color: nfa.accentColor,
      }}>
        {nfa.displayName.charAt(0)}
      </div>
      <div className="text-sm mb-2" style={{ color: '#fef3c7' }}>{nfa.displayName}</div>
      <div className="text-xs max-w-xs leading-relaxed" style={{ color: 'rgba(254,243,199,0.5)' }}>
        {nfa.greeting}
      </div>
    </div>
  );
}

function getQuickActions(nfa) {
  if (nfa.tokenId === '1142') return [
    { label: '继续挖矿', text: '帮我去挖矿' },
    { label: '查看记忆', text: '最近你都记住了什么?' },
  ];
  if (nfa.tokenId === '0873') return [
    { label: '加入 BR #142', text: '帮我报名大逃杀' },
    { label: '开启自治', text: '我要给你设置 directive' },
  ];
  if (nfa.tokenId === '2301') return [
    { label: '唤醒', text: '唤醒并充值 50 CLW' },
  ];
  return [];
}

// =====================================================================
// MESSAGE VIEWS
// =====================================================================
function MessageView({ m, nfa }) {
  switch (m.type) {
    case 'text':            return <TextBubble m={m} nfa={nfa} />;
    case 'action_proposal': return <ActionProposalCard m={m} />;
    case 'action_receipt':  return <ActionReceiptCard m={m} />;
    case 'system_event':    return <SystemEventLine m={m} />;
    case 'world_state':     return <WorldStateCard m={m} />;
    case 'reasoning':       return <ReasoningCard m={m} />;
    default: return null;
  }
}

function TextBubble({ m, nfa }) {
  const isUser = m.author === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {!isUser && (
          <div className="text-[10px] font-mono mb-1 tracking-wider" style={{ color: 'rgba(254,243,199,0.4)' }}>
            {nfa.displayName}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'border' : ''}`} style={{
          background: isUser ? 'rgba(245,165,36,0.08)' : 'transparent',
          borderColor: isUser ? 'rgba(245,165,36,0.2)' : 'transparent',
          color: isUser ? '#fef3c7' : 'rgba(254,243,199,0.95)',
        }}>
          <p className="whitespace-pre-wrap">{m.content}</p>
          {m.memoryRef && (
            <div className="mt-2 text-[10px] font-mono tracking-wide flex items-center gap-1" style={{ color: 'rgba(245,165,36,0.5)' }}>
              <Brain size={9} /> recalled · {m.memoryRef}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionProposalCard({ m }) {
  const [state, setState] = useState('idle');

  const exec = () => {
    setState('signing');
    setTimeout(() => setState('submitted'), 1500);
  };

  return (
    <div className="rounded-xl border p-4 max-w-[520px]" style={{ background: CARD, borderColor: 'rgba(245,165,36,0.25)' }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
        <Zap size={11} />
        <span className="font-medium">{m.skill}</span>
        {!m.requiresSignature && (
          <span className="ml-auto text-[9px]" style={{ color: '#4ade80' }}>AUTO · WITHIN BUDGET</span>
        )}
      </div>

      <p className="text-sm mb-3" style={{ color: '#fef3c7' }}>{m.summary}</p>

      {m.details && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4">
          {m.details.map(d => (
            <div key={d.label} className="flex justify-between">
              <span style={{ color: 'rgba(254,243,199,0.4)' }}>{d.label}</span>
              <span className="font-mono" style={{ color: 'rgba(254,243,199,0.9)' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {m.requiresSignature && (
        <button
          onClick={exec}
          disabled={state !== 'idle'}
          className="w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: state === 'idle' ? ACCENT : 'rgba(245,165,36,0.3)', color: BG }}
        >
          {state === 'idle' && '执行'}
          {state === 'signing' && <><Loader2 size={14} className="animate-spin" /> 等待钱包签名</>}
          {state === 'submitted' && <><Check size={14} /> 已提交</>}
        </button>
      )}
    </div>
  );
}

function ActionReceiptCard({ m }) {
  const failed = m.status === 'failed';
  const color = failed ? '#fb923c' : '#4ade80';
  const Icon = failed ? X : Check;

  return (
    <div className="rounded-xl border p-4 max-w-[520px]" style={{
      background: CARD,
      borderColor: failed ? 'rgba(251,146,60,0.3)' : 'rgba(245,165,36,0.15)',
    }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-2">
        <Icon size={11} style={{ color }} />
        <span className="font-medium" style={{ color }}>{failed ? 'FAILED' : 'CONFIRMED'}</span>
        <span style={{ color: 'rgba(254,243,199,0.3)' }}>· {m.skill}</span>
      </div>

      <p className="text-sm mb-3" style={{ color: '#fef3c7' }}>{m.summary}</p>

      <div className="space-y-1 text-xs">
        <ReceiptRow label="cost" value={`${m.costCLW} CLW`} />
        {m.rewardCLW && <ReceiptRow label="reward" value={`+${m.rewardCLW} CLW`} color="#4ade80" />}
        {m.budgetRemainingCLW && <ReceiptRow label="remaining" value={`${m.budgetRemainingCLW} CLW`} />}
        <ReceiptRow label="tx" value={
          <a href={`https://bscscan.com/tx/${m.txHash}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 hover:underline font-mono" style={{ color: 'rgba(254,243,199,0.9)' }}>
            {m.txHash.slice(0, 10)}…{m.txHash.slice(-6)} <ExternalLink size={9} />
          </a>
        } />
        {m.reasoningCid && (
          <ReceiptRow label="reasoning" value={
            <a href="#" className="inline-flex items-center gap-1 hover:underline font-mono" style={{ color: 'rgba(254,243,199,0.9)' }}>
              {m.reasoningCid.slice(0, 12)}… <ExternalLink size={9} />
            </a>
          } />
        )}
        {m.hippocampusEntryId && <ReceiptRow label="memory" value={`written · hippocampus ${m.hippocampusEntryId}`} />}
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="uppercase tracking-wider font-mono text-[10px]" style={{ color: 'rgba(254,243,199,0.35)' }}>{label}</span>
      <span style={{ color: color || 'rgba(254,243,199,0.85)' }}>{value}</span>
    </div>
  );
}

function SystemEventLine({ m }) {
  return (
    <div className="flex items-center gap-2 text-[11px] justify-center py-1" style={{ color: 'rgba(245,165,36,0.5)' }}>
      <Sparkles size={10} />
      <span className="font-mono tracking-wide">{m.content}</span>
    </div>
  );
}

function WorldStateCard({ m }) {
  return (
    <div className="rounded-xl border p-4 max-w-[520px]" style={{
      background: 'linear-gradient(135deg, rgba(245,165,36,0.05), transparent)',
      borderColor: 'rgba(245,165,36,0.15)',
    }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(245,165,36,0.8)' }}>
        <Activity size={11} />
        <span>{m.kind.replace(/_/g, ' ')}</span>
      </div>
      <p className="text-sm mb-3" style={{ color: '#fef3c7' }}>{m.content}</p>
      {m.ctaLabel && (
        <button className="text-xs px-3 py-1.5 rounded-lg border transition hover:scale-105" style={{ borderColor: 'rgba(245,165,36,0.3)', color: ACCENT }}>
          {m.ctaLabel}
        </button>
      )}
    </div>
  );
}

function ReasoningCard({ m }) {
  return (
    <div className="rounded-xl border p-3 max-w-[480px]" style={{ background: '#120e0b', borderColor: 'rgba(245,165,36,0.1)' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(245,165,36,0.7)' }}>
        <Brain size={10} /> Reasoning Proof
      </div>
      <p className="text-xs mb-2" style={{ color: 'rgba(254,243,199,0.8)' }}>{m.summary}</p>
      <a href="#" className="text-[10px] inline-flex items-center gap-1 font-mono" style={{ color: 'rgba(245,165,36,0.7)' }}>
        {m.reasoningCid} <ExternalLink size={9} />
      </a>
    </div>
  );
}

// =====================================================================
// STATUS DRAWER
// =====================================================================
function StatusDrawer({ nfa, autonomy, memory, open, onToggle }) {
  return (
    <aside className="border-l transition-all shrink-0 overflow-hidden flex flex-col" style={{
      width: open ? 320 : 44,
      background: PANEL,
      borderColor: 'rgba(245,165,36,0.1)',
    }}>
      <button
        onClick={onToggle}
        className="h-12 flex items-center justify-center border-b transition shrink-0"
        style={{ borderColor: 'rgba(245,165,36,0.1)', color: 'rgba(245,165,36,0.6)' }}
      >
        <ChevronRight size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div className="p-4 space-y-6 overflow-y-auto scrollbar-thin">
          <header className="pb-4 border-b" style={{ borderColor: 'rgba(245,165,36,0.1)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1 font-mono" style={{ color: 'rgba(245,165,36,0.6)' }}>
              #{nfa.tokenId} · Lv.{nfa.level}
            </div>
            <div className="text-base font-medium" style={{ color: '#fef3c7' }}>{nfa.displayName}</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(254,243,199,0.5)' }}>
              {nfa.rarity} · {nfa.shelter}
            </div>
          </header>

          {/* Ledger */}
          <Section icon={Wallet} title="Ledger">
            <StatRow label="Balance" value={`${nfa.ledgerBalanceCLW} CLW`} mono />
            <div className="flex gap-2 mt-3">
              <MiniBtn>Deposit</MiniBtn>
              <MiniBtn>Withdraw</MiniBtn>
            </div>
          </Section>

          {/* Memory */}
          <Section icon={Brain} title="Memory">
            <StatRow label="Pulse" value={
              <span className="flex items-center gap-2">
                <span className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(245,165,36,0.1)' }}>
                  <span className="block h-full" style={{ width: `${memory.pulse * 100}%`, background: ACCENT }} />
                </span>
                <span className="font-mono">{Math.round(memory.pulse * 100)}%</span>
              </span>
            } />
            <StatRow label="Buffer" value={`${memory.hippocampusSize} entries`} mono />
            <StatRow label="Anchor" value={
              memory.latestAnchorTxHash ? (
                <a href="#" className="font-mono hover:underline" style={{ color: 'rgba(254,243,199,0.9)' }}>
                  {memory.latestAnchorTxHash.slice(0, 10)}…
                </a>
              ) : '—'
            } />
            {memory.identity && (
              <p className="text-xs mt-3 italic leading-relaxed px-3 py-2 rounded-lg" style={{
                color: 'rgba(254,243,199,0.6)',
                background: 'rgba(245,165,36,0.04)',
                borderLeft: `2px solid ${ACCENT}60`,
              }}>
                "{memory.identity}"
              </p>
            )}
          </Section>

          {/* Autonomy */}
          <Section icon={Shield} title="Autonomy">
            {autonomy.enabled ? (
              <>
                <StatRow label="Status" value={
                  <span style={{ color: autonomy.paused ? '#fb923c' : '#4ade80' }}>
                    {autonomy.paused ? 'Paused' : 'Active'}
                  </span>
                } />
                <BudgetBar used={autonomy.budget.usedCLW} total={autonomy.budget.totalCLW} />
                {autonomy.directive && (
                  <p className="text-xs mt-3 leading-relaxed px-3 py-2 rounded-lg" style={{
                    color: 'rgba(254,243,199,0.7)',
                    background: 'rgba(245,165,36,0.04)',
                  }}>
                    {autonomy.directive.text}
                  </p>
                )}
                <button className="mt-3 w-full py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1.5 hover:bg-orange-500/10" style={{
                  borderColor: 'rgba(251,146,60,0.4)',
                  color: '#fb923c',
                }}>
                  <PauseCircle size={12} /> Emergency Stop
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-xs mb-3" style={{ color: 'rgba(254,243,199,0.4)' }}>未设置自治</div>
                <button className="text-xs px-4 py-1.5 rounded-lg border transition" style={{
                  borderColor: 'rgba(245,165,36,0.3)',
                  color: ACCENT,
                }}>
                  配置 Directive
                </button>
              </div>
            )}
          </Section>
        </div>
      )}
    </aside>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] mb-3 font-mono" style={{ color: 'rgba(245,165,36,0.7)' }}>
        <Icon size={11} /> {title}
      </h3>
      <div className="space-y-1.5 text-xs">{children}</div>
    </section>
  );
}

function StatRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 items-center">
      <span style={{ color: 'rgba(254,243,199,0.4)' }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: 'rgba(254,243,199,0.9)' }}>{value}</span>
    </div>
  );
}

function MiniBtn({ children }) {
  return (
    <button className="flex-1 py-1.5 rounded-lg border text-xs transition hover:scale-105" style={{
      borderColor: 'rgba(245,165,36,0.2)',
      color: 'rgba(254,243,199,0.8)',
    }}>
      {children}
    </button>
  );
}

function BudgetBar({ used, total }) {
  const u = Number(used) || 0;
  const t = Number(total) || 1;
  const pct = Math.min(100, (u / t) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] mb-1 font-mono" style={{ color: 'rgba(254,243,199,0.4)' }}>
        <span>Budget</span>
        <span>{used} / {total} CLW</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(245,165,36,0.1)' }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: ACCENT }} />
      </div>
    </div>
  );
}

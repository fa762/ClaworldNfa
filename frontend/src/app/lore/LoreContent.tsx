'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface LoreAct {
  id: string;
  title: string;
  content: string;
}

export function LoreContent({ acts }: { acts: LoreAct[] }) {
  const [activeAct, setActiveAct] = useState(0);

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-3 text-sm mb-6">
        {acts.map((act, i) => (
          <button
            key={act.id}
            onClick={() => setActiveAct(i)}
            className={`transition-all ${
              activeAct === i ? 'term-active' : 'term-dim hover:text-crt-green'
            }`}
          >
            {activeAct === i ? '> ' : '  '}{act.title}
          </button>
        ))}
      </div>

      <div className="term-line mb-6" />

      {/* Content */}
      <article key={activeAct} className="animate-fade-in">
        <div className="prose prose-invert prose-base max-w-none
          [&_h1]:text-crt-bright [&_h1]:glow-strong [&_h1]:text-xl [&_h1]:mt-8 [&_h1]:mb-4
          [&_h2]:text-crt-bright [&_h2]:glow [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3
          [&_h3]:text-crt-bright [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:text-crt-green [&_p]:leading-loose [&_p]:text-sm [&_p]:mb-3
          [&_strong]:text-crt-bright [&_strong]:font-bold
          [&_em]:text-crt-dim [&_em]:italic
          [&_hr]:border-crt-darkest [&_hr]:my-8
          [&_blockquote]:border-l-2 [&_blockquote]:border-crt-dim [&_blockquote]:pl-4 [&_blockquote]:text-crt-dim [&_blockquote]:italic
          [&_a]:text-crt-bright [&_a]:underline
        ">
          <ReactMarkdown>{acts[activeAct]?.content || ''}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

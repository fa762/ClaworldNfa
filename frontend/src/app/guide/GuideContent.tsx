'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

const MD_STYLES = `prose prose-invert prose-sm max-w-none
  [&_h1]:text-crt-bright [&_h1]:glow [&_h1]:text-lg [&_h1]:mt-4 [&_h1]:mb-2
  [&_h2]:text-crt-bright [&_h2]:glow [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-crt-bright [&_h3]:text-sm [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:text-crt-green [&_p]:leading-relaxed [&_p]:text-sm
  [&_a]:text-crt-bright [&_a]:underline
  [&_strong]:text-crt-bright [&_strong]:font-bold
  [&_em]:text-crt-dim [&_em]:italic
  [&_table]:text-xs [&_table]:border-collapse
  [&_th]:text-crt-bright [&_th]:border-b [&_th]:border-crt-dim [&_th]:py-1 [&_th]:text-left
  [&_td]:border-b [&_td]:border-crt-darkest [&_td]:py-1
  [&_hr]:border-crt-darkest [&_hr]:my-4
  [&_blockquote]:border-l-2 [&_blockquote]:border-crt-dim [&_blockquote]:pl-4 [&_blockquote]:text-crt-dim [&_blockquote]:italic
  [&_code]:text-crt-bright [&_code]:bg-crt-bg [&_code]:px-1 [&_code]:text-xs
  [&_li]:text-crt-green [&_li]:text-sm
  [&_ul]:space-y-0.5`;

export function GuideContent({ chapters }: { chapters: Chapter[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
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

      {/* Right: selected chapter only */}
      <div className="pipboy-split-content" key={activeIdx}>
        <div className="flex items-center gap-2 mb-3">
          <span className="term-bright text-xs">[{String(activeIdx + 1).padStart(2, '0')}]</span>
          <span className="term-bright text-sm glow">{chapters[activeIdx]?.title}</span>
        </div>
        <div className={MD_STYLES}>
          <ReactMarkdown>{chapters[activeIdx]?.content || ''}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

/* removed - using .md-content from globals.css */

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
        <div className="md-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapters[activeIdx]?.content || ''}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

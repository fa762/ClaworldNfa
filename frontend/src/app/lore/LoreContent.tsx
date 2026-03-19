'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LoreSection {
  id: string;
  title: string;
  content: string;
}

interface LoreAct {
  id: string;
  title: string;
  sections: LoreSection[];
}

/* removed - using .md-content from globals.css */

export function LoreContent({ acts }: { acts: LoreAct[] }) {
  const [actIdx, setActIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);

  const currentAct = acts[actIdx];
  const sections = currentAct?.sections || [];
  const currentSection = sections[sectionIdx];

  function switchAct(i: number) {
    setActIdx(i);
    setSectionIdx(0);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Act tabs at top */}
      <div className="flex gap-1 px-4 pt-2 pb-1 border-b border-crt-darkest shrink-0">
        {acts.map((act, i) => (
          <button
            key={act.id}
            onClick={() => switchAct(i)}
            className={`pipboy-tab text-xs ${i === actIdx ? 'pipboy-tab-active' : ''}`}
          >
            {act.title}
          </button>
        ))}
      </div>

      {/* Split: sidebar chapters + content */}
      <div className="pipboy-split">
        <div className="pipboy-split-sidebar">
          {sections.map((sec, i) => (
            <button
              key={sec.id}
              onClick={() => setSectionIdx(i)}
              className={`pipboy-sidebar-item ${i === sectionIdx ? 'pipboy-sidebar-active' : ''}`}
            >
              {i === sectionIdx ? '> ' : '  '}{sec.title}
            </button>
          ))}
        </div>

        <div className="pipboy-split-content" key={`${actIdx}-${sectionIdx}`}>
          {currentSection && (
            <>
              <div className="term-bright text-sm glow mb-3">{currentSection.title}</div>
              <div className="md-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentSection.content}</ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

const MD_STYLES = `prose prose-invert prose-sm max-w-none
  [&_h1]:text-crt-bright [&_h1]:glow-strong [&_h1]:text-lg [&_h1]:mt-4 [&_h1]:mb-3
  [&_h2]:text-crt-bright [&_h2]:glow [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-crt-bright [&_h3]:text-sm [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:text-crt-green [&_p]:leading-loose [&_p]:text-sm [&_p]:mb-2
  [&_strong]:text-crt-bright [&_strong]:font-bold
  [&_em]:text-crt-dim [&_em]:italic
  [&_hr]:border-crt-darkest [&_hr]:my-4
  [&_blockquote]:border-l-2 [&_blockquote]:border-crt-dim [&_blockquote]:pl-4 [&_blockquote]:text-crt-dim [&_blockquote]:italic
  [&_a]:text-crt-bright [&_a]:underline`;

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
              <div className={MD_STYLES}>
                <ReactMarkdown>{currentSection.content}</ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

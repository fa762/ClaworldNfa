'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookText } from 'lucide-react';

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
      <div className="glass-card rounded-xl p-1.5 mb-10 inline-flex gap-1">
        {acts.map((act, i) => (
          <button
            key={act.id}
            onClick={() => setActiveAct(i)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeAct === i
                ? 'bg-legend-gold/15 text-legend-gold shadow-sm'
                : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            {activeAct === i && <BookText size={14} />}
            {act.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <article className="animate-fade-in" key={activeAct}>
        <div className="prose prose-invert prose-base max-w-none
          prose-headings:font-heading prose-headings:text-mythic-white
          prose-h1:text-3xl prose-h1:text-gradient-gold prose-h1:mb-6
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-gray-300 prose-p:leading-loose prose-p:mb-4
          prose-strong:text-mythic-white prose-strong:font-semibold
          prose-em:text-gray-400 prose-em:italic
          prose-hr:border-white/[0.06] prose-hr:my-10
          prose-blockquote:border-l-2 prose-blockquote:border-legend-gold/40 prose-blockquote:text-gray-400 prose-blockquote:italic prose-blockquote:bg-legend-gold/[0.03] prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
          prose-a:text-legend-gold prose-a:no-underline hover:prose-a:underline
        ">
          <ReactMarkdown>{acts[activeAct]?.content || ''}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

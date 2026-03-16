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
      <div className="flex gap-2 mb-8 border-b border-white/10">
        {acts.map((act, i) => (
          <button
            key={act.id}
            onClick={() => setActiveAct(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeAct === i
                ? 'border-abyss-orange text-abyss-orange'
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            {act.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="prose prose-invert prose-base max-w-none
        prose-headings:font-heading prose-headings:text-mythic-white
        prose-p:text-gray-300 prose-p:leading-loose
        prose-strong:text-white
        prose-em:text-gray-400
        prose-hr:border-white/10
        prose-blockquote:border-abyss-orange prose-blockquote:text-gray-400
      ">
        <ReactMarkdown>{acts[activeAct]?.content || ''}</ReactMarkdown>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

export function GuideContent({ chapters }: { chapters: Chapter[] }) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.id || '');

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <nav className="hidden md:block w-56 shrink-0 sticky top-20 self-start">
        <ul className="space-y-1">
          {chapters.map((ch) => (
            <li key={ch.id}>
              <button
                onClick={() => {
                  setActiveChapter(ch.id);
                  document.getElementById(ch.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`w-full text-left text-sm px-3 py-2 rounded transition-colors ${
                  activeChapter === ch.id
                    ? 'bg-abyss-orange/20 text-abyss-orange'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {ch.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {chapters.map((ch) => (
          <section key={ch.id} id={ch.id} className="mb-12">
            <h2 className="font-heading text-2xl text-mythic-white mb-4">{ch.title}</h2>
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:font-heading prose-headings:text-mythic-white
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-tech-blue
              prose-strong:text-white
              prose-table:text-sm
              prose-th:text-gray-400 prose-th:border-white/10
              prose-td:border-white/10 prose-td:text-gray-300
              prose-hr:border-white/10
              prose-blockquote:border-abyss-orange prose-blockquote:text-gray-400
              prose-code:text-abyss-orange prose-code:bg-card-dark prose-code:px-1 prose-code:rounded
            ">
              <ReactMarkdown>{ch.content}</ReactMarkdown>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

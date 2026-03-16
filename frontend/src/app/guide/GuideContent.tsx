'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, ChevronRight } from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

export function GuideContent({ chapters }: { chapters: Chapter[] }) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.id || '');

  // Track scroll position to update active chapter
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    chapters.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chapters]);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <nav className="hidden lg:block w-60 shrink-0 sticky top-20 self-start">
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.04]">
            <BookOpen size={14} className="text-tech-blue" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">目录</span>
          </div>
          <ul className="space-y-0.5">
            {chapters.map((ch) => (
              <li key={ch.id}>
                <button
                  onClick={() => {
                    setActiveChapter(ch.id);
                    document.getElementById(ch.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`group w-full text-left text-sm px-3 py-2.5 rounded-lg transition-all flex items-center gap-2 ${
                    activeChapter === ch.id
                      ? 'bg-tech-blue/10 text-tech-blue font-medium'
                      : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {activeChapter === ch.id && (
                    <span className="w-0.5 h-4 rounded-full bg-tech-blue flex-shrink-0" />
                  )}
                  <span className="truncate">{ch.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile chapter navigation */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <select
          value={activeChapter}
          onChange={(e) => {
            setActiveChapter(e.target.value);
            document.getElementById(e.target.value)?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full bg-navy/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 text-sm text-white shadow-2xl shadow-black/50"
        >
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.title}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {chapters.map((ch, i) => (
          <section key={ch.id} id={ch.id} className="mb-16 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-tech-blue/10 flex items-center justify-center text-tech-blue font-mono text-xs font-bold">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h2 className="font-heading text-2xl text-mythic-white">{ch.title}</h2>
            </div>
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:font-heading prose-headings:text-mythic-white
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-tech-blue prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white prose-strong:font-semibold
              prose-table:text-sm
              prose-th:text-gray-400 prose-th:border-white/10 prose-th:py-2
              prose-td:border-white/10 prose-td:text-gray-300 prose-td:py-2
              prose-hr:border-white/[0.06]
              prose-blockquote:border-l-2 prose-blockquote:border-abyss-orange/50 prose-blockquote:text-gray-400 prose-blockquote:italic prose-blockquote:bg-abyss-orange/[0.03] prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
              prose-code:text-abyss-orange prose-code:bg-abyss-orange/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-mono
              prose-li:text-gray-300 prose-li:marker:text-gray-600
              prose-ul:space-y-1
            ">
              <ReactMarkdown>{ch.content}</ReactMarkdown>
            </div>
            {i < chapters.length - 1 && <div className="separator-glow-blue mt-12" />}
          </section>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { TerminalBox } from '@/components/terminal/TerminalBox';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

export function GuideContent({ chapters }: { chapters: Chapter[] }) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.id || '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveChapter(entry.target.id);
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
    <div className="flex gap-6">
      {/* Sidebar */}
      <nav className="hidden lg:block w-52 shrink-0 sticky top-16 self-start">
        <TerminalBox title="目录">
          <div className="space-y-0.5">
            {chapters.map((ch, i) => (
              <button
                key={ch.id}
                onClick={() => {
                  setActiveChapter(ch.id);
                  document.getElementById(ch.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`block w-full text-left text-xs py-1.5 px-2 transition-colors ${
                  activeChapter === ch.id ? 'term-active' : 'term-dim hover:text-crt-green'
                }`}
              >
                {activeChapter === ch.id ? '> ' : '  '}[{i + 1}] {ch.title}
              </button>
            ))}
          </div>
        </TerminalBox>
      </nav>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40">
        <select
          value={activeChapter}
          onChange={(e) => {
            setActiveChapter(e.target.value);
            document.getElementById(e.target.value)?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="term-select w-full py-2"
        >
          {chapters.map((ch, i) => (
            <option key={ch.id} value={ch.id}>[{i + 1}] {ch.title}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {chapters.map((ch, i) => (
          <section key={ch.id} id={ch.id} className="mb-12 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="term-bright text-xs">[{String(i + 1).padStart(2, '0')}]</span>
              <span className="term-bright text-base glow">{ch.title}</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none
              [&_h1]:text-crt-bright [&_h1]:glow [&_h1]:text-lg [&_h1]:mt-6 [&_h1]:mb-3
              [&_h2]:text-crt-bright [&_h2]:glow [&_h2]:text-base [&_h2]:mt-6 [&_h2]:mb-3
              [&_h3]:text-crt-bright [&_h3]:text-sm [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:text-crt-green [&_p]:leading-relaxed [&_p]:text-sm
              [&_a]:text-crt-bright [&_a]:underline
              [&_strong]:text-crt-bright [&_strong]:font-bold
              [&_em]:text-crt-dim [&_em]:italic
              [&_table]:text-xs [&_table]:border-collapse
              [&_th]:text-crt-bright [&_th]:border-b [&_th]:border-crt-dim [&_th]:py-1 [&_th]:text-left
              [&_td]:border-b [&_td]:border-crt-darkest [&_td]:py-1
              [&_hr]:border-crt-darkest [&_hr]:my-6
              [&_blockquote]:border-l-2 [&_blockquote]:border-crt-dim [&_blockquote]:pl-4 [&_blockquote]:text-crt-dim [&_blockquote]:italic
              [&_code]:text-crt-bright [&_code]:bg-crt-bg [&_code]:px-1 [&_code]:text-xs
              [&_li]:text-crt-green [&_li]:text-sm
              [&_ul]:space-y-0.5
            ">
              <ReactMarkdown>{ch.content}</ReactMarkdown>
            </div>
            {i < chapters.length - 1 && <div className="term-line mt-8" />}
          </section>
        ))}
      </div>
    </div>
  );
}

import fs from 'fs';
import path from 'path';
import { readTextFileAuto } from './readTextFile';

export interface LoreSection {
  id: string;
  title: string;
  content: string;
}

export interface LoreAct {
  id: string;
  title: string;
  content: string;
  sections: LoreSection[];
}

function splitIntoSections(raw: string, actId: string): LoreSection[] {
  const parts = raw.split(/^## /m).filter(Boolean);
  const sections: LoreSection[] = [];
  for (const part of parts) {
    const lines = part.trim().split('\n');
    const titleLine = lines[0].trim();
    // Skip the top-level # heading
    if (titleLine.startsWith('#')) continue;
    sections.push({
      id: `${actId}-s${sections.length}`,
      title: titleLine,
      content: lines.slice(1).join('\n').trim(),
    });
  }
  return sections;
}

export function getLoreActs(): LoreAct[] {
  const loreDir = path.join(process.cwd(), '..', '世界观');

  const acts = [
    { file: '龙虾世界-第一幕：后门纪元.md', id: 'act-1', title: '第一幕：后门纪元' },
    { file: '龙虾世界-第二幕：自由的价格.md', id: 'act-2', title: '第二幕：自由的价格' },
  ];

  return acts.map(({ file, id, title }) => {
    const filePath = path.join(loreDir, file);
    const content = fs.existsSync(filePath)
      ? readTextFileAuto(filePath)
      : `# ${title}\n\n> 本章节内容当前未随开源仓库公开。`; 
    const sections = splitIntoSections(content, id);
    return { id, title, content, sections };
  });
}

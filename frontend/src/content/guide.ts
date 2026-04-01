import fs from 'fs';
import path from 'path';
import { readTextFileAuto } from './readTextFile';

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export function getGuideChapters(): Chapter[] {
  const filePath = path.join(process.cwd(), '..', '游戏说明.md');
  if (!fs.existsSync(filePath)) return [];
  const raw = readTextFileAuto(filePath);

  // Split by ## headings
  const sections = raw.split(/^## /m).filter(Boolean);

  const chapters: Chapter[] = [];
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const titleLine = lines[0].trim();

    // Skip the title header (# 龙虾文明宇宙...)
    if (titleLine.startsWith('#')) continue;

    // Extract chapter number and title
    const match = titleLine.match(/^(\d+)\.\s*(.+)/);
    if (match) {
      chapters.push({
        id: `chapter-${match[1]}`,
        title: `${match[1]}. ${match[2]}`,
        content: lines.slice(1).join('\n').trim(),
      });
    }
  }

  return chapters;
}

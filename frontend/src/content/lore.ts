import fs from 'fs';
import path from 'path';

export interface LoreAct {
  id: string;
  title: string;
  content: string;
}

export function getLoreActs(): LoreAct[] {
  const loreDir = path.join(process.cwd(), '..', '世界观');

  const acts = [
    { file: '龙虾世界-第一幕：后门纪元.md', id: 'act-1', title: '第一幕：后门纪元' },
    { file: '龙虾世界-第二幕：自由的价格.md', id: 'act-2', title: '第二幕：自由的价格' },
  ];

  return acts.map(({ file, id, title }) => {
    const filePath = path.join(loreDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    return { id, title, content };
  });
}

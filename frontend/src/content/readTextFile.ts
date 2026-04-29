import fs from 'fs';
import { isUtf8 } from 'buffer';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function decodeGb18030(bytes: Buffer): string {
  return new TextDecoder('gb18030').decode(bytes);
}

export function readTextFileAuto(filePath: string): string {
  const bytes = fs.readFileSync(filePath);

  if (isUtf8(bytes)) {
    return stripBom(bytes.toString('utf8'));
  }

  return stripBom(decodeGb18030(bytes));
}

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const assetPath = resolve(process.cwd(), '..', 'art', 'exports', 'sprites', 'lobster_walk_v1.png');
    const image = await readFile(assetPath);

    return new Response(image, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Sprite not found', { status: 404 });
  }
}

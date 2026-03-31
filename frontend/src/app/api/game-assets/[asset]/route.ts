import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const runtime = 'nodejs';

const ASSET_PATHS: Record<string, string> = {
  'lobster-walk': resolve(process.cwd(), '..', 'art', 'exports', 'sprites', 'player_walk_latest.png'),
  'npc-task': resolve(process.cwd(), '..', 'art', 'sources', 'npc_task_terminal_v1.png'),
  'npc-pk': resolve(process.cwd(), '..', 'art', 'sources', 'npc_pk_terminal_v1.png'),
  'npc-market': resolve(process.cwd(), '..', 'art', 'sources', 'npc_market_wall_v1.png'),
  portal: resolve(process.cwd(), '..', 'art', 'sources', 'portal_v1.png'),
  'npc-openclaw': resolve(process.cwd(), '..', 'art', 'sources', 'npc_openclaw_pod_v1.png'),
  'tile-floor': resolve(process.cwd(), '..', 'art', 'sources', 'tile_floor_panel_v1.png'),
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  const assetPath = ASSET_PATHS[asset];

  if (!assetPath) {
    return new Response('Asset not found', { status: 404 });
  }

  try {
    const image = await readFile(assetPath);
    return new Response(image, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return new Response('Asset not found', { status: 404 });
  }
}

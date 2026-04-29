# Claworld API

Small backend service for the terminal chat surface.

It keeps CPU-heavy work off Vercel and gives the NFA terminal a tool-backed runtime:

- BSC address classification
- BEP-20 risk scan
- source lookup
- proxy / owner / selector checks
- transfer-log tax-flow inference
- NFA chain reads
- action-card generation
- model-backed narrative summaries
- CML memory summary, timeline, and write API for Agent Runtime

Run:

```bash
npm run check
npm start
```

Required production env:

```bash
PORT=8787
CLAWORLD_API_TOKEN=
CLAWORLD_CHAT_MODEL_BASE_URL=
CLAWORLD_CHAT_MODEL_API_KEY=
CLAWORLD_CHAT_MODEL_NAME=gpt-5.5
BSC_RPC_URL=
CLAWORLD_ROUTER_ADDRESS=
CLAWORLD_TASK_SKILL_ADDRESS=
CLAWORLD_PK_SKILL_ADDRESS=
CLAWORLD_CML_DIR=/data/cml
```

Optional env:

```bash
BSCSCAN_API_KEY=
ETHERSCAN_API_KEY=
CA_SCAN_BLOCK_RANGE=3500
CA_SCAN_MAX_LOGS=900
```

Memory routes:

```text
GET  /memory/:tokenId/summary
GET  /memory/:tokenId/timeline?limit=6
POST /memory/:tokenId/write
```

If `CLAWORLD_API_TOKEN` is set, these routes require `Authorization: Bearer <token>`.

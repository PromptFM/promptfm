---
name: unified-pathway-matrix
description: >-
  Mandates and defines the Unified Pathway Matrix, Implementation Axes, and Reusage Grade
  for all user-facing, community, and administrative features in PromptFM.
---

# Unified Pathway Matrix & Implementation Reusage Standard

Whenever implementing, modifying, or refactoring user-facing, community, or broadcast features in PromptFM (such as song requests, dedications, weather drops, voting, reporting, or airplay queue management), you **MUST** route all entrypoints through a single unified pathway service.

> [!IMPORTANT]
> **Zero Fragmented Domain Logic (Issue #43 Resolution)**:
> Features must NEVER implement custom database inserts, independent track lookups, or divergent status/ETA messages across different entrypoints. A listener typing `/song` in Discord, a user in Telegram, an AI agent via MCP, an admin in the Web Studio, and a developer in the CLI **MUST** trigger the exact same core pathway.

---

## 1. The 6 Implementation Axes to Cover

Every core broadcast capability must systematically cover all applicable access axes:

```
                      ┌─────────────────────────────────────────┐
                      │      Unified Pathway Core Service       │
                      │        (src/lib/<feature>/pathway.ts)    │
                      │                                         │
                      │  • Safety & Broadcast Ethics Guardrails │
                      │  • Semantic RAG & Entity Resolution     │
                      │  • Deduplication & In-Flight Tracking   │
                      │  • Real-time Queue Depth & Live ETA     │
                      │  • Unified Confirmation Formatter       │
                      └────────────────────┬────────────────────┘
                                           │
         ┌───────────────┬─────────────────┼────────────────┬───────────────┐
         ▼               ▼                 ▼                ▼               ▼
     [Axis 1]        [Axis 2]          [Axis 3]         [Axis 4]        [Axis 5]
      Discord        Telegram             MCP          Web Admin           CLI
   Slash /song     Bot Webhook       Tools API &     Studio Queue &    promptfm queue
    & Buttons     /song & /s        Agent Queries     Admin REST API    promptfm song
```

### Axis Breakdown:
1. **Axis 1 — Discord Interactive Gateway**:
   - Application command (`/song`, `/dedicate`, `/report`, etc.) in `src/app/api/bot/webhook/route.ts`.
   - Returns ephemeral or channel confirmation using unified formatter with position and provisional ETA.
2. **Axis 2 — Telegram Interactive Bot**:
   - Webhook commands (`/song`, `/s`, shorthands) in `src/app/api/bot/webhook/route.ts`.
   - Sends Telegram reply message using unified confirmation.
3. **Axis 3 — Model Context Protocol (MCP)**:
   - Tool calls (`promptfm_queue_song_request`, `promptfm_check_song_queue`) in `src/app/api/mcp/route.ts`.
   - Returns structured JSON containing `success`, `queue_position`, `estimated_air_time`, `message`.
4. **Axis 4 — Web Admin Studio**:
   - Admin UI (`/admin`) and dedicated REST API (`/api/admin/queue/route.ts`).
   - Surfaces real-time queue position badges, live provisional ETAs, and priority bump actions.
5. **Axis 5 — Terminal Station CLI**:
   - CLI script (`scripts/promptfm.ts`) via `npm run promptfm queue <prompt>` or `promptfm song <prompt>`.
   - Queries queue status via `getSongQueueStatus` and prints live ETAs.
6. **Axis 6 — Public / Web Direct API**:
   - Public JSON payloads handled uniformly by the pathway service.

---

## 2. Reusage Grade Matrix

Evaluate every feature implementation against this reusage scorecard before declaring completion:

| Grade | Reusage Criteria | Status |
|---|---|---|
| **Grade A (100% Unified)** | **MANDATORY**: 100% of domain logic (guardrails, resolution, deduplication, live ETA calculation, formatting) resides in a single `src/lib/<feature>/pathway.ts`. All 5+ entrypoint controllers only parse input, call the pathway, and serialize the response. | ✅ Production Ready |
| **Grade B (Partial - 70-80%)** | Shared database tables, but bot handlers or CLI calculate their own ETAs or search tracks independently. Causes schedule drift and duplicate requests (Root cause of Issue #43). | ❌ Deficient (Refactor Required) |
| **Grade C (Fragmented - <60%)** | Separate queries, duplicated SQL, or divergent confirmation messages across Discord, Telegram, or Web. | 🚫 Prohibited |

---

## 3. Mandatory 3-Layer Testing Protocol

Every unified pathway requires 3 verification layers:

1. **Layer 1: Unit Tests (`tests/unit/<feature>-pathway.test.ts`)**:
   - ETA calculation boundary conditions (itemsAhead = 0, 1, N, negative values, minimum clamp).
   - Formatters (singular/plural minutes, with/without artist, position tags).
   - Core pathway deduplication (currently playing check, already queued check).
   - Guardrails refusal (with and without custom refusal messages).
   - Direct ID lookup and priority bump.
2. **Layer 2: Integration Tests (`tests/integration/unified-<feature>-pathway.test.ts`)**:
   - Discord webhook interaction -> receives position & provisional ETA.
   - Telegram webhook command -> receives reply with position & provisional ETA.
   - MCP tool execution -> returns structured queue position & ETA.
   - Admin API route (GET/POST/DELETE) -> verifies live queue and management.
   - Cross-pathway deduplication -> verifies Discord + Telegram cannot double-book the same track.
3. **Layer 3: Playwright E2E Tests (`tests/e2e/<feature>.spec.ts`)**:
   - End-to-end browser / API validation of the queue and public schedule display.

---

## 4. Mutation Testing Verification

Always verify Stryker mutation testing on the unified pathway module:
```bash
npx stryker run --mutate "src/lib/<feature>/pathway.ts"
```
- **Threshold**: Mutation score **≥ 80%**.
- **Requirement**: Zero surviving mutants on scheduling, deduplication, queue position, or guardrails logic.

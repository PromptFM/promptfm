# Project Rules: PromptFM

## Engineering Mandates

1. **Test-Driven Development (TDD) Mandatory**:
   - Every time code is written, changed, or refactored, you MUST write unit and/or integration tests following the Red → Green → Refactor cycle.
   - Write failing test first (`npm test` -> RED).
   - Write minimal implementation to pass (`npm test` -> GREEN).
   - Clean up types and structure (`npm run typecheck` + `npm test` -> REFACTOR).
   - Run mutation testing (`npm run test:mutate` -> MUTATE) to ensure no surviving mutants on core business logic.

2. **Test Framework**:
   - Vitest (`vitest.config.ts`) for unit and integration testing.
   - Stryker Mutator (`stryker.config.json`) for mutation testing.
   - Run with `npm test`, `npm run test:coverage`, `npm run test:mutate`.

3. **Admin & Operational Documentation**:
   - All admin capabilities (content moderation, reporting, playlist curation, voice drops) must be clearly documented with CLI, API, MCP, and UI commands.


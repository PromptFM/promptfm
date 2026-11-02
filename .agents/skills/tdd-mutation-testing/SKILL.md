---
name: tdd-mutation-testing
description: >-
  Enforces strict Test-Driven Development (TDD), Red-Green-Refactor cycles, unit tests,
  integration tests, and Stryker mutation testing whenever writing, editing, or refactoring
  code in this codebase.
---

# Test-Driven Development (TDD) & Mutation Testing Protocol

Whenever writing new features, fixing bugs, or refactoring existing code in this repository, you **MUST** follow the Red-to-Green TDD and Mutation Testing protocol.

--------------------------------------------------------------------------------

## 1. The Core Methodology: Red → Green → Refactor → Mutate

```
┌─────────┐      ┌─────────┐      ┌────────────┐      ┌────────────┐
│ 1. RED  │ ───> │2. GREEN │ ───> │3. REFACTOR │ ───> │ 4. MUTATE  │
└─────────┘      └─────────┘      └────────────┘      └────────────┘
Write failing    Write minimal    Clean code &        Run Stryker to
unit & integr.   code to make     types, keeping      kill mutants
test first       all tests pass   all tests green     & test edges
```

### Phase 1: RED (Write the Test First)
1. **Do not write implementation code before writing the test.**
2. Formulate the requirements as executable assertions.
3. Place tests in `tests/unit/` or `tests/integration/` (or co-located `*.test.ts`).
4. Run the test suite:
   ```bash
   npm test
   ```
5. **Verify the test fails** for the expected reason (e.g., function undefined, assertion mismatch, missing route).

### Phase 2: GREEN (Minimal Implementation)
1. Write the minimal production code needed to satisfy the test requirements.
2. Avoid over-engineering or adding untested speculative logic.
3. Run the test suite again:
   ```bash
   npm test
   ```
4. Verify all tests pass cleanly.

### Phase 3: REFACTOR (Quality & Type Safety)
1. Clean up duplicated logic, improve naming, optimize algorithms.
2. Verify strict TypeScript adherence:
   ```bash
   npm run typecheck
   ```
3. Re-run `npm test` to ensure zero regressions.

### Phase 4: MUTATE (Mutation Testing with Stryker)
Test coverage (lines/branches) can be deceptive if assertions are weak. Mutation testing tests your test suite by injecting deliberate bugs into your production code ("mutants"):
* Changing `>` to `>=` or `<`
* Changing `true` to `false`
* Removing function call arguments or returning empty arrays/strings
* Removing conditional statements

1. Run Stryker mutation testing on targeted modules:
   ```bash
   npm run test:mutate
   ```
2. **Goal:** Mutation score ≥ 80% with 0 survived mutants on new business logic.
3. If mutants survive, analyze why: did a test fail to assert a boundary condition or return value? Add the missing test assertion and re-run.

--------------------------------------------------------------------------------

## 2. Test Framework & Commands

* **Unit & Integration Runner:** Vitest (`vitest.config.ts`)
* **Mutation Testing Engine:** Stryker Mutator (`stryker.config.json`)

### Standard Commands
```bash
# Run all unit & integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with code coverage report
npm run test:coverage

# Run Stryker mutation testing
npm run test:mutate

# Run TypeScript compilation check
npm run typecheck
```

--------------------------------------------------------------------------------

## 3. Test Structure Standards

* **Unit Tests (`tests/unit/**/*.test.ts`)**:
  * Focus on isolated pure functions, domain models, validation, and algorithmic logic.
  * Fast (< 100ms), deterministic, no real network or external API calls.
* **Integration Tests (`tests/integration/**/*.test.ts`)**:
  * Test route handlers (`/api/report`, `/api/bot/webhook`, `/api/mcp`), database adapters, and state machines working together.
  * Mock external network calls (e.g. Telegram API, Discord Webhook, Google Gemini) to keep tests fast and sandbox-compliant.


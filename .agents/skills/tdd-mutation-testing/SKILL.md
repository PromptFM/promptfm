---
name: tdd-mutation-testing
description: >-
  Enforces strict Test-Driven Development (TDD), Red-Green-Refactor cycles, unit tests,
  integration tests, and Stryker mutation testing whenever writing, editing, or refactoring
  code in this codebase.
---

# Test-Driven Development (TDD) & Mutation Testing Protocol

Whenever writing new features, fixing bugs, or refactoring existing code in this repository, you **MUST** follow the Red → Green → Refactor → Mutate cycle.

> [!CAUTION]
> **MANDATORY MUTATION TESTING GATE: NEVER STOP AT GREEN!**
> Green tests alone are **INSUFFICIENT**. You are strictly prohibited from declaring a task finished, concluding work, or reporting completion to the user until you have run Stryker mutation testing (`npx stryker run --mutate "<changed-file>"`) on all created/modified production code and verified a **mutation score of ≥ 80%** with zero surviving mutants on core business logic.

--------------------------------------------------------------------------------

## 1. The 4-Phase Cycle: Red → Green → Refactor → Mutate

```
┌─────────┐      ┌─────────┐      ┌────────────┐      ┌────────────┐
│ 1. RED  │ ───> │2. GREEN │ ───> │3. REFACTOR │ ───> │ 4. MUTATE  │
└─────────┘      └─────────┘      └────────────┘      └────────────┘
Write failing    Write minimal    Clean code &        Run Stryker on
unit/integr.     code to make     types, keeping      modified files;
test first       all tests pass   all tests green     kill all mutants (≥80%)
```

### Phase 1: RED (Write the Test First)
1. **Never write implementation code before writing the test.**
2. Formulate the requirements as executable assertions.
3. Place tests in `tests/unit/` or `tests/integration/` (or co-located `*.test.ts`).
4. Run Vitest:
   ```bash
   npm test
   ```
5. **Verify the test fails** for the expected reason (e.g., function undefined, assertion mismatch, missing route).

### Phase 2: GREEN (Minimal Implementation)
1. Write the minimal production code needed to satisfy the test requirements.
2. Avoid over-engineering or adding untested speculative logic.
3. Run Vitest:
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

### Phase 4: MUTATE (Mutation Testing with Stryker — MANDATORY)
1. **Run targeted Stryker mutation testing on every modified or new production file**:
   ```bash
   npx stryker run --mutate "src/path/to/modified-file.ts"
   ```
2. **Examine the report:**
   - Goal: **Mutation score ≥ 80%**.
   - Check `[Survived]` mutants. Each survived mutant represents untested boundary logic (e.g. edge condition inverted, boolean swapped, fallback bypassed, error handling ignored).
3. **Kill surviving mutants**:
   - Write targeted test assertions in your test file that specifically fail if the mutant is present.
   - Refactor out redundant/unreachable conditionals if the code cannot be observed or reached.
4. **Re-run Stryker** until the mutation score is ≥ 80%.

--------------------------------------------------------------------------------

## 2. Fast Mutation Testing Commands

When modifying specific modules, do NOT run full-suite mutation testing blindly (which may test 100+ files and take minutes). Run targeted mutation testing immediately after reaching green:

```bash
# 1. Automatic targeted mutation on all changed domain files in PR/branch:
npm run test:mutate:affected

# 2. Targeted mutation on a single file:
npx stryker run --mutate "src/lib/audio/player-controller.ts"

# 3. Targeted mutation on a directory:
npx stryker run --mutate "src/lib/audio/**/*.ts"

# 4. Targeted mutation on multiple files:
npx stryker run --mutate "src/lib/reporting/report-service.ts,src/lib/email/resend.ts"

# 5. Full project mutation test:
npm run test:mutate
```

--------------------------------------------------------------------------------

## 3. Completion Checklist (Check Before Any Response to User)

Before responding to the user or declaring a coding task done, verify every item:
- [ ] 1. Tests were written first (Red verified).
- [ ] 2. Implementation makes all tests pass (Green: `npm test` exit 0).
- [ ] 3. Strict typechecking passes (`npm run typecheck` exit 0).
- [ ] 4. Stryker mutation test executed on changed code (`npx stryker run --mutate ...`).
- [ ] 5. Mutation score is ≥ 80% with surviving mutants analyzed and addressed.

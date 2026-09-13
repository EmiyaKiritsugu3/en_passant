# Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade project dependencies to their latest stable versions while eliminating deprecated API usages and keeping 100% test coverage and build stability.

**Architecture:** Staged upgrade approach by risk profile: first eliminate deprecated `Move.flags` from `lib/coach/analysis.ts`, then modernize runtime target and `@types/node`, followed by patch/minor runtime packages (Next.js, React, Zod, Anthropic SDK), and finally validate major tooling bumps (Vitest 5, ESLint 10, TypeScript 7). Every stage is gated by typechecking, linting, and unit/E2E test suites.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, Tailwind v4, Zod, chess.js.

**Spec:** `.claude/projects/-home-emiyakiritsugu-Projetos-Antigravity-chess/memory/dependency-upgrade-queue.md`

## Global Constraints

- Never break existing test suites (68 unit tests, 15 Playwright E2E tests).
- All commits follow conventional commits (`fix:`, `chore:`, `refactor:`).
- Work on isolated git branch (`chore/dependency-upgrades`).
- In React 19, no synchronous `setState` inside `useEffect` (rule `set-state-in-effect`).
- E2E tests must clear storage in page initialization.

---

### Task 1: Remove Deprecated `Move.flags` in `lib/coach/analysis.ts`

**Files:**
- Modify: `lib/coach/analysis.ts:201-206`
- Test: `lib/coach/analysis.test.ts`

**Interfaces:**
- Consumes: `input.moveSan`
- Produces: `isCastling: boolean` without relying on `input.flags` (deprecated in chess.js v1, removed in v2)

- [ ] **Step 1: Check existing test coverage for castling analysis**

Run: `npm test -- lib/coach/analysis.test.ts`
Expected: PASS

- [ ] **Step 2: Update `lib/coach/analysis.ts` to derive `isCastling` purely from SAN**

In `lib/coach/analysis.ts:203`:
```typescript
const isCastling = moveSan === "O-O" || moveSan === "O-O-O";
```

- [ ] **Step 3: Run unit tests to verify castling detection still works**

Run: `npm test -- lib/coach/analysis.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/coach/analysis.ts
git commit -m "refactor(coach): remove deprecated Move.flags usage for castling detection"
```

---

### Task 2: Modernize `@types/node` and tsconfig Target to ES2022

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: Node 22+ runtime features (structuredClone, Array.at, crypto.randomUUID)
- Produces: ES2022 target output and updated node type definitions

- [ ] **Step 1: Update `@types/node` to `^22` in `package.json`**

Install:
```bash
npm install -D @types/node@^22
```

- [ ] **Step 2: Update `tsconfig.json` target to `ES2022`**

In `tsconfig.json`:
```json
"target": "ES2022"
```

- [ ] **Step 3: Verify TypeScript compilation and unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (0 type errors, 68 tests passing)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore(deps): bump @types/node to 22 and update tsconfig target to ES2022"
```

---

### Task 3: Upgrade Patch/Minor Runtime Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Next.js: `16.3.4` -> `16.3.5`
- eslint-config-next: `16.3.4` -> `16.3.5`
- React: `19.2.8` -> `19.3.0`
- React-DOM: `19.2.8` -> `19.3.0`
- @types/react: `^19.2.18` -> `^19.3.0`
- @types/react-dom: `^19.2.7` -> `^19.3.0`
- Zod: `^4.5.4` -> `^4.6.3`
- @anthropic-ai/sdk: `^0.124.0` -> `^0.125.0`
- Vite: `^8.2.2` -> `^8.3.0`

- [ ] **Step 1: Install patch and minor upgrades**

```bash
npm install next@16.3.5 react@19.3.0 react-dom@19.3.0 zod@^4.6.3 @anthropic-ai/sdk@^0.125.0
npm install -D eslint-config-next@16.3.5 @types/react@^19.3.0 @types/react-dom@^19.3.0 vite@^8.3.0
```

- [ ] **Step 2: Run typecheck, lint, and unit tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS

- [ ] **Step 3: Run build to verify Next.js production bundler**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): update Next.js, React, Zod, and Anthropic SDK to latest minor/patch"
```

---

### Task 4: Upgrade Major Tooling (Vitest 5, ESLint 10, TypeScript 7)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `eslint.config.mjs` (if needed for ESLint 10)
- Modify: `vitest.config.ts` (if needed for Vitest 5)

- [ ] **Step 1: Test upgrade of Vitest to 5.x**

```bash
npm install -D vitest@^5.0.0
npm test
```
Verify all 68 tests pass and no configuration deprecations are triggered.

- [ ] **Step 2: Test upgrade of ESLint to 10.x**

```bash
npm install -D eslint@^10.10.0
npm run lint
```
Verify flat config `eslint.config.mjs` compatibility with ESLint 10 and `eslint-config-next`.

- [ ] **Step 3: Test upgrade of TypeScript to 7.x**

```bash
npm install -D typescript@^7.0.2
npx tsc --noEmit
```
Verify no Go-native port regressions or flag incompatibilities in `tsconfig.json`.

- [ ] **Step 4: Commit major tooling updates**

```bash
git add package.json package-lock.json eslint.config.mjs vitest.config.ts
git commit -m "chore(deps): upgrade vitest to v5, eslint to v10, and typescript to v7"
```

---

### Task 5: End-to-End Regression & Memory Update

**Files:**
- Test: `e2e/*.spec.ts`
- Modify: `.claude/projects/-home-emiyakiritsugu-Projetos-Antigravity-chess/memory/dependency-upgrade-queue.md`

- [ ] **Step 1: Execute full test and build verification**

```bash
npm run test && npm run lint && npm run build && npm run test:e2e
```
Expected: All 68 unit tests, lint, production build, and all 15 Playwright E2E tests PASS.

- [ ] **Step 2: Update memory queue file**

Mark items completed in `dependency-upgrade-queue.md`.

- [ ] **Step 3: Open Pull Request**

Push branch `chore/dependency-upgrades` and create PR with full verification summary.

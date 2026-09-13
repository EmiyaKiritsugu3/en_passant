# Arena Noir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Arena Noir identity (walnut dark, bronze accent, felt board, Fraunces + Inter) across app.

**Architecture:** Tokens in `app/globals.css` `@theme` top-level; fonts in `app/layout.tsx` via `next/font`; board theme as one CSS file swapped in `Board.tsx`; component recolor zinc/amber to noir/bronze; Lucide replaces emoji.

**Tech Stack:** Next 16, React 19, Tailwind v4, chessground 9, lucide-react (new).

**Spec:** `docs/superpowers/specs/2026-09-13-arena-noir-design.md`

## Global Constraints

- Tailwind v4: `@theme` top-level only, never nested in media query.
- Keep all a11y roles/names (E2E depends on them); only emoji-text selectors change, with spec updates in same task.
- pt-BR copy unchanged except emoji removal.
- Geist_Mono kept as utility mono face (spec deviation: 3 faces total, mono already pervasive; swapping it all is churn with zero visual gain).
- Branch `feat/arena-noir`, PR at end. No direct commits to main.

---

### Task 1: Tokens + fonts

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: utilities `bg-noir-bg`, `bg-noir-surface`, `bg-noir-raised`, `text-noir-ink`, `text-noir-muted`, `border-noir-line`, `bg-bronze`, `bg-bronze-deep`, `text-bronze`, `font-display`, `ease-out-expo` for Tasks 4-5.

- [ ] **Step 1: Replace globals.css theme block**

Replace lines 3-20 of `app/globals.css` with:

```css
@theme {
  --color-noir-bg: oklch(0.20 0.015 60);
  --color-noir-surface: oklch(0.26 0.02 60);
  --color-noir-raised: oklch(0.31 0.025 60);
  --color-noir-ink: oklch(0.93 0.02 75);
  --color-noir-muted: oklch(0.68 0.03 70);
  --color-noir-line: oklch(0.93 0.02 75 / 0.12);
  --color-bronze: oklch(0.68 0.11 70);
  --color-bronze-deep: oklch(0.55 0.10 65);
  --color-felt: oklch(0.48 0.11 155);
  --color-felt-light: oklch(0.85 0.05 95);
  --font-display: "Fraunces", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Keep `@import "tailwindcss";` at top. Delete old `:root` + `@theme inline` + dark media block (dark-first fixo, sem toggle). Body rule becomes:

```css
body {
  background: var(--color-noir-bg);
  color: var(--color-noir-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Swap fonts in layout.tsx**

Replace Geist imports with:

```tsx
import { Fraunces, Inter, Geist_Mono } from "next/font/google";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
```

`<html>` className uses `${display.variable} ${sans.variable} ${mono.variable}`. `lang="en"` becomes `lang="pt-BR"`.

- [ ] **Step 3: Verify tokens compile**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

Run: `grep -c "noir-\|bronze\|felt" app/globals.css`
Expected: number >= 10.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(theme): add Arena Noir tokens, Fraunces + Inter fonts"
```

### Task 2: Board noir theme

**Files:**
- Create: `components/chessground-noir.css`
- Modify: `components/Board.tsx` (import swap only)

**Interfaces:**
- Consumes: nothing (standalone CSS).
- Produces: felt board rendering used by arena (no API change).

- [ ] **Step 1: Write board CSS**

```css
/** Arena Noir board: felt green + walnut frame, checker via conic gradient */
cg-board {
  background-color: #e8d5b7;
  background-image: repeating-conic-gradient(#e8d5b7 0% 25%, #2e6b41 0% 50%);
  background-size: 25% 25%;
}

/** Interactive board square colors */
cg-board square.move-dest {
  background: radial-gradient(rgba(20, 85, 30, 0.5) 22%, #208530 0, rgba(0, 0, 0, 0.3) 0, rgba(0, 0, 0, 0) 0);
}
cg-board square.oc.move-dest {
  background: radial-gradient(transparent 0%, transparent 80%, rgba(20, 85, 0, 0.3) 80%);
}
cg-board square.move-dest:hover {
  background: rgba(20, 85, 30, 0.3);
}
cg-board square.last-move {
  background-color: rgba(200, 151, 92, 0.3);
}
cg-board square.selected {
  background-color: rgba(200, 151, 92, 0.45);
}
cg-board square.check {
  background: radial-gradient(
    ellipse at center,
    rgba(255, 0, 0, 1) 0%,
    rgba(231, 0, 0, 1) 25%,
    rgba(169, 0, 0, 0) 89%,
    rgba(158, 0, 0, 0) 100%
  );
}
```

Copy coord color rules verbatim from `node_modules/chessground/assets/chessground.brown.css` lines 45-63 (unchanged behavior).

- [ ] **Step 2: Swap import in Board.tsx**

Replace `import "chessground/assets/chessground.brown.css";` with `import "./chessground-noir.css";`. Keep base + cburnett imports.

- [ ] **Step 3: Run arena load test**

Run: `npx playwright test e2e/play-arena.spec.ts -g "arena loads"`
Expected: PASS, board visible with felt squares.

- [ ] **Step 4: Commit**

```bash
git add components/chessground-noir.css components/Board.tsx
git commit -m "feat(board): felt + walnut chessground theme"
```

### Task 3: Lucide replaces emoji

**Files:**
- Modify: `components/arena/CoachConsole.tsx` (BADGE_CONFIG labels, hint button, notice pill)
- Modify: `app/play/page.tsx` (sound toggle, random button, any emoji)
- Modify: `app/page.tsx` (module icons from JSON stay, inline emoji go)
- Modify: `e2e/play-arena.spec.ts` (sound selector, chat bubble class)
- Modify: `package.json` (add lucide-react, latest)

**Interfaces:**
- Consumes: nothing.
- Produces: emoji-free UI; E2E uses title/text selectors (Tasks 4-6 rely on green suite).

- [ ] **Step 1: Install lucide-react**

Run: `npm i lucide-react@latest`
Expected: dependency added, `npm ls lucide-react` prints version.

- [ ] **Step 2: Strip emoji, keep text**

`CoachConsole.tsx` BADGE_CONFIG: `brilliant: "Lance Brilhante"`, `solid: "Bom Lance"`, `inaccurate: "Imprecisão"`, `mistake: "Erro Tático"`, `blunder: "Capivarada"`. No emoji, no `animate-pulse`. Hint button text stays `Pedir Dica Tática (GM)` with `<Lightbulb size={14} />` icon. Notice pill uses `<Lightbulb>` not 💡. Sound toggle uses `<Volume2>` / `<VolumeX size={16}>`, keeps `title` + `aria-pressed` attrs verbatim. Home random button uses `<Dices size={14}>` not 🎲.

- [ ] **Step 3: Update E2E selectors**

`e2e/play-arena.spec.ts` line 53: replace `page.locator("header button").filter({ hasText: /🔊|🔇/ })` with `page.getByTitle(/som/i)`. Line 125: replace `page.locator(".bg-amber-600\\/20")` with `page.getByRole("tabpanel").getByText("Você")`.

- [ ] **Step 4: Verify zero emoji + tests**

Run: `grep -rPn "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" app components --include="*.tsx" | grep -v "^Binary"`
Expected: empty output.

Run: `npx playwright test e2e/play-arena.spec.ts -g "sound toggle|chat interaction"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components app e2e
git commit -m "feat(icons): lucide replaces emoji, e2e selectors updated"
```

### Task 4: Arena recolor

**Files:**
- Modify: `components/arena/CoachConsole.tsx` (zinc/amber classes to noir/bronze)
- Modify: `components/arena/PlayerCard.tsx`
- Modify: `components/arena/EvalBar.tsx`
- Modify: `components/arena/MoveHistory.tsx`
- Modify: `app/play/page.tsx`

**Interfaces:**
- Consumes: Task 1 utilities, Task 3 icons.
- Produces: fully noir arena.

- [ ] **Step 1: Recolor arena components**

Mapping (apply mechanically, every occurrence): `zinc-950`/`zinc-900` bg to `bg-noir-surface`; `zinc-800` bg to `bg-noir-raised`; `zinc-700` border to `border-noir-line`; `zinc-300`/`zinc-200`/`white` text to `text-noir-ink`; `zinc-400`/`zinc-500` text to `text-noir-muted`; `amber-500` accents/borders-active to `border-bronze` + `text-bronze`; `amber-600`/`amber-700` CTA bg to `bg-bronze-deep`; `amber-400` small text to `text-bronze`. Headings that are page/section titles get `font-display`. Numbers (clocks, ratings) get `tabular-nums`. `bg-[#161512]` literals become `bg-noir-bg`. Keep all `role`, `aria-*`, ids, test text content identical.

- [ ] **Step 2: Verify no legacy tokens in arena**

Run: `grep -rn "zinc-\|amber-\|#161512" components/arena app/play --include="*.tsx"`
Expected: empty output.

- [ ] **Step 3: Run arena E2E**

Run: `npx playwright test e2e/play-arena.spec.ts`
Expected: all PASS (7 tests).

- [ ] **Step 4: Commit**

```bash
git add components/arena app/play
git commit -m "feat(arena): noir recolor, bronze accents, display type"
```

### Task 5: Remaining pages recolor

**Files:**
- Modify: `app/page.tsx`, `app/dashboard/page.tsx`, `app/train/page.tsx`, `app/library/page.tsx`, `app/study/page.tsx`, `app/trainer/punishment/page.tsx`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: consistent noir app shell.

- [ ] **Step 1: Apply same mapping as Task 4**

Same class mapping. Section eyebrows (`uppercase tracking-widest text-amber-500 font-mono`) become `text-bronze` without tracking-widest on every section (keep max one kicker per page). Page titles get `font-display`.

- [ ] **Step 2: Verify repo-wide**

Run: `grep -rn "zinc-\|amber-\|#161512" app components --include="*.tsx"`
Expected: empty output.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app
git commit -m "feat(pages): noir recolor across home, dashboard, train, library, study"
```

### Task 6: Verify + cleanup + PR

**Files:**
- Delete: `en-passant-arena-concept.html`, `.playwright-mcp/` contents
- Modify: none (verification only)

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: green main via PR.

- [ ] **Step 1: Full unit suite**

Run: `npm test`
Expected: PASS, 69/69 (or current count, zero failures).

- [ ] **Step 2: Full E2E suite**

Run: `npm run test:e2e`
Expected: PASS, 16/16 (or current count, zero failures).

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS both.

- [ ] **Step 4: Delete concept debris**

Run: `rm en-passant-arena-concept.html && rm -rf .playwright-mcp/ && git status -sb`
Expected: only intended files changed.

- [ ] **Step 5: Push + open PR**

Run: `git push -u origin feat/arena-noir && gh pr create --fill`
Expected: PR URL printed. Report URL, do not merge without user approval.

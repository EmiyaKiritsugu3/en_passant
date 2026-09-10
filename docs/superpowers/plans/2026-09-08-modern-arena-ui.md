# Modern & Interactive Chess Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Transform the `/play` interface into a modern, immersive, and interactive chess arena with an evaluation bar, player HUDs (material counter & turn pulse), non-destructive move history navigation, native procedural audio effects, and a dark glassmorphism GM Coach console.

**Architecture:** A modular component architecture (`components/arena/`) orchestrated by `app/play/page.tsx`. Audio is generated procedurally via the browser's native Web Audio API (zero external assets, 100% offline). The board layout centers the Chessground arena alongside the vertical `EvalBar`, bordered by upper/lower `PlayerCard` HUDs and a right-hand column split between `MoveHistory` and `CoachConsole`.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2.8, TypeScript, Tailwind CSS, Chessground, chess.js, Web Audio API, Stockfish 18 WASM, Vitest.

> **As-built (2026-09-09):** Tasks 1–8 código-prontas (`npm run lint` limpo, `vitest` 59 PASS, `tsc` limpo, visual validado via DevTools: tabuleiro 520×520, sem scroll horizontal). Desvios: testes de eval vivem em `lib/chess/evalbar.test.ts` (não `components/arena/EvalBar.test.ts`); `PlayerCard` usa props `badge`/`isEngine`/`isThinking` (não `title`/`avatarIcon`); badge de review é *"Modo Análise"*; sem atalho `D` na dica; aba Posição sem king-safety/peças desenvolvidas (só fase, lances, tablebase, tags).

---

## File Structure

- **Create:**
  - `lib/sound/audio.ts`: Procedural Web Audio API sound generator (move, capture, check, game end) + localStorage mute persistence.
  - `lib/sound/audio.test.ts`: Unit tests for sound manager methods and mute toggle.
  - `lib/chess/material.ts`: Pure utility function to compute captured pieces and net material advantage from FEN/board.
  - `lib/chess/material.test.ts`: Unit tests for material calculation.
  - `components/arena/EvalBar.tsx`: Smooth vertical evaluation bar with sigmoid scaling and player perspective mirroring.
  - `components/arena/EvalBar.test.ts`: Unit tests for evaluation percentages, bounds, and mate formatting.
  - `components/arena/PlayerCard.tsx`: Player HUD with avatar, name/title badge, turn pulse ring, and captured pieces display.
  - `components/arena/MoveHistory.tsx`: Move notation table with transport buttons (`⏮`, `◀`, `▶`, `⏭`, `🔄`) and review-mode safety.
  - `components/arena/CoachConsole.tsx`: Dark glassmorphism card with tabs (*Crítica*, *Intenção*, *Posição*, *Conversar*), *💥 Capivarada!* badge, and illuminated Hint button.
- **Modify:**
  - `app/play/page.tsx`: Refactor layout to responsive 3-column modern arena, wire sound effects, hook up temporal history navigation, and integrate `EvalBar`, `PlayerCard`s, and `CoachConsole`.

---

## Tasks

### Task 1: Procedural Audio Engine (`lib/sound/audio.ts`)

- [x] **Step 1.1: Write failing unit test for audio generator**
  - File: `lib/sound/audio.test.ts`
  - Test: Verifies `getAudioMuted()`, `setAudioMuted(boolean)`, and that `playMoveSound`, `playCaptureSound`, `playCheckSound`, `playGameEndSound` execute without errors in browser/mock environments.
- [x] **Step 1.2: Run test to verify failure**
  - Run: `npx vitest run lib/sound/audio.test.ts`
- [x] **Step 1.3: Implement `lib/sound/audio.ts`**
  - File: `lib/sound/audio.ts`
  - Implementation: Safe Web Audio API synthesizer. When in SSR or mocked environment, fails gracefully without throwing. Synthesizes 4 discrete sound profiles using OscillatorNode + GainNode envelopes.
- [x] **Step 1.4: Run test to verify pass**
  - Run: `npx vitest run lib/sound/audio.test.ts`

---

### Task 2: Material & Captured Pieces Calculator (`lib/chess/material.ts`)

- [x] **Step 2.1: Write failing unit test for material calculation**
  - File: `lib/chess/material.test.ts`
  - Test: Calculates starting position (0 captured, 0 diff), after 1. e4 d5 2. exd5 (White captured 'p', diff +1 for White), and endgame positions.
- [x] **Step 2.2: Run test to verify failure**
  - Run: `npx vitest run lib/chess/material.test.ts`
- [x] **Step 2.3: Implement `lib/chess/material.ts`**
  - File: `lib/chess/material.ts`
  - Implementation: Takes a `Chess` instance or FEN string, counts current pieces, subtracts from initial 16 pieces per color, and returns `{ whiteCaptured: string[], blackCaptured: string[], whiteAdvantage: number, blackAdvantage: number }`.
- [x] **Step 2.4: Run test to verify pass**
  - Run: `npx vitest run lib/chess/material.test.ts`

---

### Task 3: Dynamic Evaluation Bar Component (`components/arena/EvalBar.tsx`)

- [x] **Step 3.1: Write unit tests for evaluation percentage mapping**
  - File: `components/arena/EvalBar.test.ts`
  - Test: Tests `calculateEvalPercentage(cp, mate, orientation)`:
    - 0 cp -> 50%
    - +400 cp (White orientation) -> ~90.9%
    - -400 cp (White orientation) -> ~9.1%
    - +400 cp (Black orientation) -> ~9.1% (mirrored so player color is on bottom)
    - Mate in 2 for White -> 100% (or 0% for Black orientation)
- [x] **Step 3.2: Run test to verify failure**
  - Run: `npx vitest run components/arena/EvalBar.test.ts`
- [x] **Step 3.3: Implement `components/arena/EvalBar.tsx`**
  - File: `components/arena/EvalBar.tsx`
  - Implementation: Vertical rounded bar with CSS transition on height, score text formatting (`+1.2`, `-0.5`, `#3`), smooth background gradients, and orientation awareness.
- [x] **Step 3.4: Run test to verify pass**
  - Run: `npx vitest run components/arena/EvalBar.test.ts`

---

### Task 4: Player HUD Component (`components/arena/PlayerCard.tsx`)

- [x] **Step 4.1: Implement `components/arena/PlayerCard.tsx`**
  - File: `components/arena/PlayerCard.tsx`
  - Implementation:
    - Props: `name`, `title`, `rating`, `color`, `isTurn`, `capturedPieces`, `materialAdvantage`, `avatarIcon`.
    - Visual: Translucent dark card with subtle borders, active turn indicator (`ring-2 ring-amber-500/50 animate-pulse`), rendered row of captured piece glyphs (♟, ♞, ♝, ♜, ♛), and material score badge (`+1`, `+3`).

---

### Task 5: Move History & Transport Bar (`components/arena/MoveHistory.tsx`)

- [x] **Step 5.1: Implement `components/arena/MoveHistory.tsx`**
  - File: `components/arena/MoveHistory.tsx`
  - Implementation:
    - Props: `moves: { ply: number; san: string; from: string; to: string }[]`, `currentViewingPly: number`, `onSelectPly: (ply: number) => void`, `onFlipBoard: () => void`.
    - Features: Alternating rows, highlighted active move, automatic scroll-to-bottom on new move, transport bar buttons (`⏮`, `◀`, `▶`, `⏭`, `🔄`), and review-mode badge when reviewing past plies.

---

### Task 6: GM Coach Glassmorphism Console (`components/arena/CoachConsole.tsx`)

- [x] **Step 6.1: Implement `components/arena/CoachConsole.tsx`**
  - File: `components/arena/CoachConsole.tsx`
  - Implementation:
    - Dark glassmorphism (`backdrop-blur-md bg-zinc-900/80 border border-zinc-800`).
    - Tabs:
      - **Crítica**: Rich breakdown with Portuguese badges: 🎯 *Melhor Lance*, 💎 *Excelente*, ⚠️ *Imprecisão*, **💥 Capivarada!** (for blunders), explaining center control, threats, and defended pieces.
      - **Intenção & Plano**: Strategic guidance and Socratic reflection question.
      - **Posição**: Game phase, king safety, and development metrics.
      - **Conversar**: Embedded chat interaction with the Coach.
    - Prominent **💡 Obter Dica (GM)** button with amber glow.

---

### Task 7: Integrate Arena in `app/play/page.tsx`

- [x] **Step 7.1: Connect audio and material calculations**
  - File: `app/play/page.tsx`
  - Implementation: Trigger `playMoveSound`, `playCaptureSound`, `playCheckSound`, or `playGameEndSound` upon move execution. Compute material balances dynamically on every move.
- [x] **Step 7.2: Wire non-destructive temporal review navigation**
  - File: `app/play/page.tsx`
  - Implementation: Store `viewingPly`. When user navigates moves in `MoveHistory`, render the corresponding FEN on `Board` in read-only mode. When user returns to `moves.length`, re-enable live gameplay.
- [x] **Step 7.3: Assemble the 3-column responsive layout**
  - File: `app/play/page.tsx`
  - Implementation: Assemble Header with audio toggle (`🔊/🔇`), Left Arena (Opponent Card + EvalBar + Board + User Card), and Right Console (`MoveHistory` + `CoachConsole`).

---

### Task 8: Verification & End-to-End Validation

- [x] **Step 8.1: Run full test suite and linter**
  - Run: `npm run lint && npx vitest run`
- [x] **Step 8.2: Start dev server and verify in Chrome DevTools**
  - Verify layout responsiveness, eval bar movement, sound triggers, move navigation, and GM Coach critique badges.

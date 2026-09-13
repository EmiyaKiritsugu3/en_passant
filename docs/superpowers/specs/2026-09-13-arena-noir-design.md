# Design: Arena Noir — identidade clássica quente

Data: 2026-09-13. Status: aprovada via mock (`en-passant-arena-concept.html`, deletar após implementação).
System opendesign: `opendesign/design-systems/arena-noir/` (tokens canônicos).

## Register

product. Design serve o jogo: board herói, chrome recua, coach revela com motion físico.

## Decisões fechadas

- Base escura quente (nogueira), não OLED preto nem zinc frio.
- Tipografia: Fraunces variável (display) + Inter (texto). `next/font`, `variable` + `display: swap`, root layout.
- Verde SÓ no tabuleiro. UI monocromática quente + bronze ≤10%.
- Badges coach: selo gravado discreto, sem pulse/emoji. Lucide no lugar de emojis.
- Tabuleiro: tema CSS próprio chessground (nogueira + feltro), substitui `brown.css`.

## Tokens (`@theme`, top-level, OKLCH)

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

Contraste: texto `noir-ink` sobre `noir-bg` ≥ 4.5:1. Bronze texto usa tom claro, nunca `#D97706` puro em corpo pequeno.

## Tipografia

- `h1-h3`: Fraunces, `text-wrap: balance`, tracking normal.
- Corpo: Inter 13-14px, leading 1.6, max 70ch.
- Números (relógio, rating): `tabular-nums`.
- 2 fontes max. Preload automático via root layout.

## Componentes

- **Cards**: `bg-noir-surface`, borda 1px `noir-line`, radius 16-20. Sem sombra pesada, sem nested cards.
- **CTA primário**: bronze-deep, texto branco, radius 12, scale 1.01 hover. Um por tela.
- **Secundários**: surface-raised + borda line, texto ink.
- **Selo coach**: uppercase 11px, bronze, borda bronze-deep, radius full. Sem pulse, sem emoji.
- **Tabs coach**: underline bronze 2px ativo, resto muted. Roving tabindex mantido.
- **Inputs**: fundo `#0e0c0a`, borda line, focus bronze.
- **Motion**: 150-300ms, `ease-out-expo`, transform/opacity apenas. `prefers-reduced-motion` alternativo crossfade.
- **Ícones**: Lucide, um set, stroke consistente. Zero emoji estrutural.

## Tabuleiro

CSS próprio chessground: casas claras felt-light, escuras felt, borda nogueira 6px + outline line. Highlight último lance bronze 0.3, dica bronze 0.45. Coordenadas discretas muted.

## Páginas

Ordem: arena → home → dashboard → treino → resto. Tokens primeiro (`globals.css` + `layout.tsx`), depois componentes arena, depois páginas.

## Testes

- Unit existentes passam (tokens não quebram lógica).
- E2E arena passa (atualizar seletor `.bg-amber-600\/20` quebrado pela troca de classes).
- Contraste AA verificado nos pares texto/fundo.
- 375px sem scroll horizontal, `prefers-reduced-motion` sem animação.

## Fora do escopo

Three.js/WebGL, GSAP, DaisyUI/Flowbite, Tailwind UI, light mode separado (dark-first fixo).

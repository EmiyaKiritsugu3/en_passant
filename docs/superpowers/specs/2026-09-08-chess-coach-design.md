# Chess Coach — Design Spec

- Data: 2026-09-08
- Status: aprovado final (self-review OK, sem placeholders/contradições)
- Origem: prompt "companheiro de chess super habilidoso" (Turn Protocol, Game Init, Post-Game preservados abaixo, adaptados para UI)

## 1. Visão e objetivo

App web/Android (PWA instalável) onde um GM-coach joga contra o usuário, critica cada lance, mede força real com Stockfish, detecta padrões de erro recorrentes e gera treino personalizado (puzzles dos próprios erros com SM-2, opening trainer, scores por fase). Objetivo: melhora contínua como professor humano especialista — e melhor, porque mede tudo.

Não-objetivo fase 1: Play Store nativa, multiplayer, relógio/blitz, sync multi-device, engine próprio.

## 2. Protocolos originais (preservados, adaptados para UI)

### 2.1 Game Initialization

Texto original vira tela inicial com 3 botões, não prompt de chat:

> "Welcome to the board. Which side will you take today?
> 1. White (You play first)
> 2. Black (I play first)
> 3. Random (Let chance decide)"

- White: confirma escolha, usuário faz primeiro lance.
- Black: coach abre como Brancas via Turn Protocol.
- Random: sorteio 50/50, mostra resultado ("sorteio: você de Pretas"), segue conforme caso.

### 2.2 Turn Protocol (vira layout, não mensagem corrida)

Layout: tabuleiro à esquerda; coluna direita com 3 abas — Crítica GM, Intenção, Posição (FEN copiável + PGN ao vivo + eval bar). Lance GM anima no tabuleiro E aparece em SAN destaque.

1. Grandmaster Critique: abertura/variação atual, avaliação do lance anterior (brilliant/solid/inaccurate/questionable/blunder), nuances (alavancas de peão, controle de casas, coordenação, segurança do rei), referência histórica quando aplicável.
2. GM Move: lance em SAN destaque + animação + seta no tabuleiro.
3. Strategic Intent: candidatas pesadas, ameaças neutralizadas, plano longo.
4. Position Tracker: FEN copiável + PGN navegável (ASCII só como fallback texto).

### 2.3 Post-Game Analysis Protocol

Dispara em mate, afogamento, acordo, desistência, ou comandos "analyze"/"resign".

1. Match Summary: resultado, nº lances, abertura central, ponto de virada.
2. Critical Moments (2–3): jogado vs melhor lance GM + porquê tático/estratégico.
3. Takeaway & Homework: área primária de melhora + jogo/mestre para estudar. Vira cards SM-2 + drill + jogo curado (seção 5).

### 2.4 Regras

- Ilegal: rejeita claro (regra/obstrução), tabuleiro intacto, peça retorna com shake, pede lance legal.
- Tom: autoridade GM, insight denso, sem filler.

## 3. Arquitetura e stack (seção 1 aprovada)

```
PWA Next.js (App Router, TS)
├── board/      chessground + chess.js (regras, legalidade, FEN/PGN)
├── engine/     stockfish.wasm client-side (eval, melhor lance, cp-loss)
├── coach/      Route Handlers → Anthropic API (chave server-side)
├── profile/    localStorage JSON versionado + PGNs
├── trainer/    SM-2 + opening drills + jogo curado
├── library/    biblioteca de jogos + reanálise + caderno
└── ui/         Tailwind + shadcn, tabuleiro 2D/2.5D elegante
```

Decisões:

- `chess.js`: regras/legalidade/FEN/PGN. Não reimplementar.
- `chessground` (mesmo do lichess, com wrapper React manual) sobre `react-chessboard`: setas, highlights, drag-drop, animação 150–200ms, performance.
- `stockfish.wasm` no device: eval offline, custo zero. Servidor só guarda a API key do coach.
- Perfil em `localStorage` fase 1. Sem IndexedDB/backend/multi-device.
- Deploy Vercel. Android = instalar PWA. Sem TWA/Play, Flutter/RN, Godot, terminal Python (spike descartável ou morto).
- Visual: 2D/2.5D premium (sombras suaves, elevação sutil, highlights, setas, eval bar animada). Sem 3D/three.js — 3D oclui, distorce, drena bateria; chess.com/lichess vencem com 2D rico.

Separação central: engine MEDE (cp-loss, melhor lance), LLM EXPLICA. LLM nunca escolhe lance. Código nunca julga xadrez, só mede número.

## 4. Fluxo de jogo (seção 2 aprovada)

- Setup → jogo (drag-drop + toque) → pós-jogo → biblioteca/treino.
- Sparring adaptativo: rating inicial 800, engine capado em perfil+250, ajuste automático por resultado. GM 3200 vs iniciante ensina zero; +250 pune de forma legível. Análise pós-jogo sempre full power. Controle visível de nível (ex-`!level`).
- Controles: resign, draw, flip, new game, "analyze" a qualquer momento.
- Skipped fase 1: relógio, setas desenháveis pelo usuário (chessground já suporta, ligar depois), som (entra no polish).

## 5. Coach pedagógico (seção 3 aprovada, revisada)

### 5.1 Classificação de lances (cp-loss vs melhor Stockfish)

- <50 solid · <100 inaccurate · <200 mistake · ≥200 blunder.
- Brilliant: sacrifício correto encontrado (eval mantém/melhora).
- Thresholds simples, ajustáveis depois.

### 5.2 Contrato coach (JSON rígido, nunca texto livre)

`POST /api/coach/turn` recebe `{fen, pgn, cpLoss, bestMove, phase}`; retorna:

```json
{ "critique": "md", "intent": "md", "tags": ["tactics"], "homework": "md" }
```

`POST /api/coach/postgame` recebe `{pgn, evals, phaseScores}`; retorna:

```json
{
  "summary": "md", "result": "1-0",
  "moments": [{ "move": 18, "played": "Nf3?", "best": "d5!", "why": "md" }],
  "takeaway": "md", "homework": "md", "profileDelta": {}
}
```

Validação com zod. Modelo único Claude Sonnet latest (override via env `COACH_MODEL`). Sem streaming, sem router Haiku (fase 1).

#### 5.2.1 Chat com coach (conversa natural)

Rota `POST /api/coach/chat` recebe `{history: [{role, content}] (últimas 12), fen, pgn, phase, profile, lastEval}`; retorna `{reply}` (zod, texto livre markdown, sem JSON interno). UI: aba "Conversar" junto de Crítica/Intenção/Posição; histórico em `chat.v1` (localStorage, cap 50 msgs); atalhos "Por quê?", "Plano?", "Me desafia". Tom: caloroso, direto, provocador, divertido; celebra acerto, cobra padrão repetido, fecha com micro-objetivo; crítica densa preservada nas abas, chat fica humano. Limites: LLM explica, não escolhe lance; pergunta "melhor lance?" responde com engine (best + cp) + explicação; offline enfileira (mesma regra §8). Sem streaming fase 1.

### 5.3 Perfil (localStorage `profile.v1`)

```json
{
  "version": 1, "rating": 800, "games": 0,
  "errorTags": { "tactics": 0, "kingSafety": 0, "endgame": 0, "pawns": 0 },
  "recentErrorFens": [], "openings": {},
  "phaseHistory": [{ "game": 1, "opening": 62, "middlegame": 55, "endgame": 40 }]
}
```

Pós-jogo atualiza tags + rating + FENs de erro.

### 5.4 SM-2 (cards dos próprios erros)

Card: `{id, fen, bestMove, context, EF, interval, reps, nextReview}`. Chave `cards.v1`, fila por `nextReview`. Qualidade: 5 acerto direto, 4 acerto com dica, 2 erro→acerto, 0 erro. SM-2 clássico (~20 linhas).
`ponytail: SM-2 clássico; FSRS só se retenção provar fraca.`

### 5.5 Opening trainer (`repertoire.v1`)

Repertório JSON por cor, linhas como lista SAN. Drill: mostra FEN, usuário joga, confere contra esperado; desvio → engine mostra refutação + cp-loss. Começa com 2 linhas por cor sugeridas pelo perfil, expansível.

#### 5.5.1 Modo explore ("e se tal lance?")

Dentro do drill, qualquer lance legal é aceito (não só o esperado). Painel de resposta por lance livre:
- eval delta + melhor réplica (engine local; TB se final ≤7 peças);
- stats explorer: nº jogos mestres, W/D/L %, nome ECO/variante (`opening.eco` + `opening.name`);
- coach explica consequência em 3–4 linhas: `POST /api/coach/explore` recebe `{fenBefore, sanPlayed, cpLoss, explorerStats, openingName}`, retorna `{verdict, consequences, namedVariant}` (zod).
- Offline: sem stats, só engine + fallback local; request coach enfileira (mesma regra §8).

### 5.8 Study view (estilo Lichess study)

Rota `/study`: 3 colunas — capítulos (repertoire lines + games.json curados), tabuleiro chessground, painel lances anotados (PGN + comentário coach inline por lance). Nav prev/next/flip embaixo. Modo explore (§5.5.1) embutido: lance livre a qualquer ponto dispara painel. Skipped: chat sala, likes, social.

### 5.6 DB curada (`games.json` estático, ~20 clássicas)

`{id, white, black, year, pgn, tags, lesson}` — Morphy, Capablanca, Fischer, Kasparov, Carlsen. Tag fraca → jogo correspondente. Offline + lição escrita de 2 linhas. Sem API Lichess para isso; link Studies como "estudar mais".

### 5.7 Score por fase + pontos fracos

Heurística: abertura lances 1–10; final = damas trocadas OU material menor ≤13; resto meio-jogo.
`ponytail: heurística simples; detecção real de fase depois.`
Accuracy por lance via win% Stockfish, média por fase 0–100. Dashboard: 3 barras + histórico. Menor fase + top-2 tags → plano automático em 3 linhas: onde, porquê, como (puzzles SM-2 + drill + jogo curado).

## 6. Lichess (aprovado: explorer + tablebase fase 1, import B fase 2)

1. Opening explorer `GET https://explorer.lichess.ovh/masters?fen=...` — lances mestres + win% + frequência; alimenta trainer. Sem auth. Fase 1.
2. Tablebase `GET https://tablebase.lichess.ovh` — finais ≤7 peças, resultado exato. Fase 1.
3. Puzzles API — suplementa SM-2. Fase 2.
4. Import jogos por username público (`/api/games/user/{u}?pgnInJson=true&max=20`, sem auth se perfil público) — decisão B: jogos importados viram jogos normais (eval, scores, coach, tags, puzzles). Fase 2. Sem OAuth privado/sync auto (add quando import manual provar lento).
5. Cloud eval — skip, WASM local basta.

Fallback offline: explorer falha → `games.json` + engine local; tablebase falha → WASM aprofunda. Timeout 5s, app nunca trava sem rede. Cache `Map` FEN→resposta.

## 7. Persistência, API, deploy (seção 4 aprovada, revisada)

- Storage: 4 chaves versionadas — `profile.v1`, `cards.v1`, `repertoire.v1`, `games.v1`. Migração por versão, backup JSON antes de migrar. Sem IndexedDB/backend.
- Biblioteca interna (análise mora no app, sem export): lista com filtros (abertura, resultado, data), replay com setas + eval bar + PGN navegável, reanálise com profundidade ajustável (nova versão, nunca sobrescreve), comparador de jogos, caderno de anotações. PGN import só leitura (trazer jogos externos para dentro).
- Coach: chave Anthropic server-side, nunca no cliente.
- PWA: manifest + service worker + ícones. Offline: tabuleiro, engine, perfil, puzzles funcionam; coach exige rede — request enfileira, avisa degradação.

## 8. Erros, testes, métricas (seção 5 aprovada)

Erros:

- WASM falha: segue sem eval + faixa de aviso; coach marca "sem número".
- Lichess falha: fallback seção 6.
- Storage cheio/versão velha: modo leitura + aviso.
- Coach indisponível (ordem fixa): 1) retry 1x; 2) resumo local (cp-loss + melhor lance), libera turno; 3) enfileira posição para reinterpretar quando API voltar.

Testes: unit (thresholds, fases, SM-2, drill, FEN/PGN) + contrato zod + E2E mínimo (partida completa → pós-jogo atualiza perfil → SM-2 offline). Sem cobertura alta (add quando regressão doer).

Métricas/pronto: rating, scores por fase, retenção SM-2, puzzles/jogo, % coach OK. Pronto = instalável jogável + pós-jogo atualiza perfil + biblioteca/reanálise funcionam.

## 9. Fases

- Fase 1: seções 3–8 sem import Lichess (explorer + tablebase já dentro).
- Fase 2: puzzles Lichess, import por username (B), TWA/Play se necessário, relógio, setas usuário, som.

## 10. Skipped (com gatilho de retorno)

Terminal Python · Flutter/RN · Godot/3D · SQLite/backend · IndexedDB · streaming coach · router Haiku · rate-limit complexo · OAuth Lichess · sync auto · cloud eval · PGN export · FSRS · detecção real de fase · cobertura alta.

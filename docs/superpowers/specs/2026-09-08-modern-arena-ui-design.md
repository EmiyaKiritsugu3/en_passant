# Modern & Interactive Chess Arena Design Specification

**Data:** 2026-09-08  
**Status:** Aprovado  
**Objetivo:** Transformar a interface de jogo (`/play`) em uma arena de xadrez moderna, imersiva e interativa (padrão Lichess / Chess.com), com HUD de jogadores, barra de avaliação vertical dinâmica, tabela de lances navegável, efeitos sonoros táteis e console do GM Coach com design dark glassmorphism.

---

## 1. Visão Geral do Produto & Arquitetura

A interface de jogo atual possui uma boa infraestrutura de motor (Stockfish 18 WASM, análise tática e regras), porém seu visual é cru e isolado. Esta especificação define a criação de uma suíte de componentes modulares dedicados em `components/arena/` e a reestruturação da tela `app/play/page.tsx` em uma grade responsiva balanceada de 3 áreas principais:

1. **Arena Central com Barra de Avaliação (Eval Bar):**
   - Barra vertical de avaliação à esquerda do tabuleiro (`components/arena/EvalBar.tsx`).
   - Tabuleiro Chessground ocupando proporções generosas e centradas.
   - Cards de jogador no topo (Coach/Stockfish) e na base (Usuário) com HUD de peças capturadas e saldo de material (`components/arena/PlayerCard.tsx`).
2. **Histórico de Lances com Navegação Temporal:**
   - Tabela em grade com destaque de lances e auto-scroll (`components/arena/MoveHistory.tsx`).
   - Barra de transporte com botões (`⏮`, `◀`, `▶`, `⏭`, `🔄`) permitindo rever posições passadas sem romper a partida.
3. **Console do GM Coach (Dark Glassmorphism):**
   - Visual translúcido sofisticado com abas (*Crítica*, *Intenção & Plano*, *Posição*, *Conversar*).
   - Selos de precisão em português, incluindo o selo brasileiro **💥 Capivarada!** para erros graves.
   - Botão de dica tática (*Dica GM*) com animação luminosa (*glow*).
4. **Sistema de Áudio Tátil Procedural:**
   - Síntese de áudio instantânea via Web Audio API (`lib/sound/audio.ts`), 100% offline, zero dependências externas e latência de 0ms.

---

## 2. Componentes e Responsabilidades

### 2.1 `EvalBar.tsx` (`components/arena/EvalBar.tsx`)
- **Largura:** ~24px a 28px, altura idêntica à do tabuleiro Chessground.
- **Cálculo da Altura (% da barra):**
  - Fórmula sigmoide padrão para centipawns:
    $$\%_{\text{brancas}} = \frac{1}{1 + 10^{-\text{cp} / 400}} \times 100$$
  - Inversão automática da barra de acordo com a orientação do tabuleiro (se Pretas estiverem embaixo, a barra inverte de modo que a cor do jogador sempre fique na base).
  - Tratamento para mate forçado: preenchimento em 100% ou 0% com badge `M<n>` / `-M<n>` (ex: `M2`, `-M3`).
- **Transição CSS:** `transition-all duration-500 ease-out` (Tailwind) sobre altura.
- **Rótulo Numérico:** Exibição clara da vantagem (`+1.5`, `-0.7`, `0.0`) com cor contrastante sobre a barra.
- **Clamp:** saída limitada a 4%–96% para o rótulo nunca sair da barra visível.

### 2.2 `PlayerCard.tsx` (`components/arena/PlayerCard.tsx`)
- **Propriedades:**
  - `name`: Nome do jogador (`GM Coach (SF 18)`, `Você`, etc.).
  - `badge`: Selo opcional (`GM`, `ALUNO`).
  - `rating`: Elo numérico opcional, renderizado `★ <elo>`.
  - `color`: `"white"` ou `"black"`.
  - `isTurn`: Booleano indicando se o jogador está na vez de jogar.
  - `capturedPieces`: Lista de peças capturadas pelo jogador (ex: `['p', 'p', 'n']`).
  - `materialAdvantage`: Número indicando a vantagem líquida (badge `+3`).
  - `isThinking` / `isEngine`: Flags opcionais de estado da engine.
- **Comportamento Visual:**
  - Anel de destaque no avatar (`ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950`, sem pulse) quando `isTurn === true`.
  - Fileira compacta de ícones das peças capturadas com badge dourado para a vantagem material.

### 2.3 `MoveHistory.tsx` (`components/arena/MoveHistory.tsx`)
- **Propriedades:**
  - `moves`: Lista de lances da partida com `{ ply, san, from, to }`.
  - `currentViewingPly`: Índice do ply sendo visualizado no momento no tabuleiro.
  - `onSelectPly`: Callback disparado ao clicar em um lance ou controle de navegação.
  - `onFlipBoard`: Callback para inverter o tabuleiro.
- **Controles de Transporte:**
  - `⏮` Início (ply 0).
  - `◀` Voltar 1 ply.
  - `▶` Avançar 1 ply.
  - `⏭` Último ply (voltar ao jogo ao vivo).
  - `🔄` Inverter perspectiva do tabuleiro.
- **Segurança de Jogo:** Quando `currentViewingPly < moves.length`, o tabuleiro desabilita novos lances do jogador e exibe um aviso sutil de *"Modo Análise"*, permitindo retornar ao lance atual a qualquer momento.

### 2.4 `CoachConsole.tsx` (`components/arena/CoachConsole.tsx`)
- **Abas:**
  - **Crítica:** Texto didático do GM explicando o que o último lance fez (controle de casas, peças defendidas, ameaças e o selo **💥 Capivarada!** em caso de blunder).
  - **Intenção:** Diretriz posicional do plano estratégico. A pergunta reflexiva (*"Exercício de Reflexão"*) vive na aba Crítica.
  - **Posição:** Fase (abertura/meio-jogo/final), contagem de lances, categoria tablebase (≤7 peças) e tags conceituais. Segurança do rei e peças desenvolvidas: não implementado.
  - **Conversar:** Diálogo interativo com o Coach.
- **Ações:**
  - Botão de Dica GM iluminado (*"💡 Pedir Dica Tática (GM)"*; sem atalho de teclado).
  - Botão para acionar o relatório pós-jogo.

### 2.5 `audio.ts` (`lib/sound/audio.ts`)
- Módulo de áudio nativo utilizando `AudioContext` do navegador:
  - `playMoveSound()`: Som percussivo suave de peça pousando (~40ms).
  - `playCaptureSound()`: Som de impacto seco com grave (~60ms).
  - `playCheckSound()`: Dois tons rápidos em frequência média-alta de alerta.
  - `playGameEndSound()`: Acorde suave de resolução de partida.
- Preferência de som (`muted: boolean`) persistida em `localStorage`.

---

## 3. Fluxo de Dados e Integração em `app/play/page.tsx`

1. **Estado da Partida:**
   - Instância `Chess` mantendo o jogo oficial.
   - `viewingChess`: Instância clone calculada quando o usuário clica em lances do passado para visualização sem alterar o estado do jogo real.
2. **Execução de Lances:**
   - Disparo do som apropriado via `audio.ts`.
   - Atualização do histórico e cálculo imediato de peças capturadas / saldo de material.
   - Envio para avaliação da engine e para o GM Coach.
3. **Avaliação Contínua:**
   - Stockfish 18 WASM atualiza `Eval` (`cp`, `mate`), refletido na `EvalBar`.

---

## 4. Plano de Validação e Testes

1. **Testes Automatizados (Vitest):**
   - Testar a matemática e mapeamento percentual da `EvalBar` (valores neutros, vantagens extremas, mates brancos e pretos).
   - Testar a contagem de peças capturadas e cálculo do saldo de material no tabuleiro.
   - Testar a integridade da navegação temporal do histórico sem mutação do estado da partida.
2. **Linter & Tipagem:**
   - `npm run lint` 100% limpo com zero avisos ou erros.
3. **Verificação Visual no Navegador:**
   - Testar o layout no Chrome DevTools com orientação de Brancas e Pretas.
   - Testar navegação de lances, clique na barra de transporte e disparos de som.

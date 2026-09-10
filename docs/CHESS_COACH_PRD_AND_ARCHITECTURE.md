# ♟️ Chess Coach AI — Product Requirements Document (PRD) & Technical Architecture
**Versão:** 1.0 — Architecture & Data Specification  
**Status:** Aprovado para Implementação  
**Autor Principal:** Sovereign Architect & AI Engineering Team  
**Repositório:** `EmiyaKiritsugu3/en_passant`  

---

## 1. Visão do Produto & Princípios Norteadores

### 1.1 Missão
> *"Aprenda xadrez. Não decore lances."*  
> O objetivo do Chess Coach AI não é dizer qual é o melhor lance via Stockfish, mas desenvolver no jogador o **modelo mental** para reconhecer desvios da teoria, diagnosticar gatilhos táticos e estratégicos, punir erros adversários e converter vantagens de forma autônoma.

### 1.2 O Diferencial Competitivo
Enquanto plataformas tradicionais (Chess.com, Lichess) oferecem análises de engine brutas (+1.4, "Blunder: Nf3 era melhor"), o Chess Coach AI atua como um **GM particular que conhece seu histórico**:
1. Sabe onde você costuma falhar (ex: decisões sob pressão em `...c5`, cálculo de trocas prematuras).
2. Não entrega a resposta de imediato: utiliza **diálogo socrático progressivo** (4 níveis de dicas).
3. Possui o **Opening Punishment Trainer (Trap Lab)**: treina a tríade **Reconhecer o Erro $\rightarrow$ Encontrar a Punição $\rightarrow$ Converter a Vantagem**.
4. **Custo operacional ultrabaixo**: Arquitetura em camadas (Tier 0 sem LLM $\rightarrow$ Tier 1 LLM rápido $\rightarrow$ Tier 2 LLM avançado sob demanda com cache multi-inquilino).

### 1.3 Métrica Estrela (North Star Metric)
* **Learning Gain Real ($\Delta$ LG)**:
  $$\Delta LG = \text{Taxa de Punição Correta em Posições Treinadas} \times \text{Redução de Capivaras Recorrentes}$$
* **Custo Médio Alvo**: $< \$0.02$ por usuário ativo/mês (90%+ das requisições resolvidas no Tier 0 / Cache).

---

## 2. Arquitetura do Sistema (System Architecture)

```
                         ┌─────────────────────────────────┐
                         │         FRONTEND (PWA)          │
                         │   Next.js 16.3.4 / React 19.2.8  │
                         │   Chessground / Tailwind CSS    │
                         └────────────────┬────────────────┘
                                          │
                            HTTPS REST / Server Actions
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │                   COACH CORE                    │
                 │                                                 │
                 │  ┌─────────────────┐   ┌─────────────────────┐  │
                 │  │  Game Manager   │   │  Pedagogical Engine │  │
                 │  └────────┬────────┘   └──────────┬──────────┘  │
                 │           │                       │             │
                 │  ┌────────▼────────┐   ┌──────────▼──────────┐  │
                 │  │ Analysis Engine │   │  Punishment Engine  │  │
                 │  │ (chess.js rule) │   │   (Trap Lab Core)   │  │
                 │  └────────┬────────┘   └──────────┬──────────┘  │
                 └───────────┼───────────────────────┼─────────────┘
                             │                       │
              ┌──────────────▼─────┐   ┌─────────────▼────────────┐
              │   Stockfish WASM   │   │   Supabase (PostgreSQL)  │
              │  (Autoridade Obj.) │   │   + LocalStorage Cache   │
              └──────────────┬─────┘   └─────────────┬────────────┘
                             │                       │
                 ┌───────────▼───────────────────────▼─────────────┐
                 │               PLAYER & SM-2 MODEL               │
                 │     Skills Radar • Weaknesses • Spaced Rep      │
                 └─────────────────────────┬───────────────────────┘
                                           │
                 ┌─────────────────────────▼───────────────────────┐
                 │                AI GATEWAY & CACHE               │
                 │           Cost Control & Budget Engine          │
                 └───────┬─────────────────────────┬───────────────┘
                         │                         │
               ┌─────────▼──────────┐   ┌──────────▼───────────────┐
               │ Tier 1 (LLM único) │   │ Tier 2 (reservado)       │
               │ COACH_MODEL        │   │ não implementado         │
               │ default Sonnet     │   │                          │
               └────────────────────┘   └──────────────────────────┘
```

---

## 3. Arquitetura de Dados & Schema do Supabase

O banco de dados utiliza PostgreSQL no Supabase com **Row-Level Security (RLS)** ativado em todas as tabelas. Schema-alvo abaixo (migrations pendentes — sem Supabase no código hoje). `lib/postgame.ts#Row` usa `{ ply, san, cpLoss, label, phase, score, fen, fenBefore, fenAfter, best }` — sem `classification`/`eval_before`/`eval_after`/`best_move_san`/`gm_critique` 1:1.

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS & PROFILES
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    rating INTEGER NOT NULL DEFAULT 1200,
    peak_rating INTEGER NOT NULL DEFAULT 1200,
    coach_mode TEXT NOT NULL DEFAULT 'teacher' 
        CHECK (coach_mode IN ('silent', 'minimal', 'training', 'teacher', 'full')),
    personality TEXT NOT NULL DEFAULT 'professor'
        CHECK (personality IN ('professor', 'trainer', 'socratic', 'competitive', 'friendly')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. PLAYER MODEL (Adaptativo & Diagnóstico)
-- ============================================================================
CREATE TABLE public.player_models (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    tactics_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    calculation_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    strategy_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    endgame_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    opening_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    weaknesses TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    strengths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    openings_mastery JSONB NOT NULL DEFAULT '{}'::JSONB, -- ex: {"london": 0.78, "caro_kann": 0.41}
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. OPENING KNOWLEDGE GRAPH & PUNISHMENT LAB
-- ============================================================================
CREATE TABLE public.openings (
    id TEXT PRIMARY KEY, -- ex: 'london_system', 'sicilian_najdorf'
    name TEXT NOT NULL,
    eco_code TEXT NOT NULL,
    description TEXT NOT NULL,
    strategic_concepts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    key_moves TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.punishment_drills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opening_id TEXT NOT NULL REFERENCES public.openings(id) ON DELETE CASCADE,
    variation_name TEXT NOT NULL,
    fen_before_blunder TEXT NOT NULL,
    opponent_mistake_san TEXT NOT NULL,
    fen_blunder TEXT NOT NULL, -- Posição exata onde o jogador deve agir
    blunder_category TEXT NOT NULL CHECK (blunder_category IN ('tactical', 'strategic')),
    trigger_type TEXT NOT NULL, -- ex: 'undefended_piece', 'king_in_center', 'premature_break'
    trigger_description TEXT NOT NULL,
    ideal_response_san TEXT NOT NULL,
    secondary_responses TEXT[] DEFAULT ARRAY[]::TEXT[],
    punishment_explanation TEXT NOT NULL,
    
    -- Escada Socrática de 4 Níveis
    hint_level_1 TEXT NOT NULL, -- O que mudou na posição?
    hint_level_2 TEXT NOT NULL, -- Qual peça ficou vulnerável ou princípio violado?
    hint_level_3 TEXT NOT NULL, -- Foco tático/geométrico específico
    hint_level_4 TEXT NOT NULL, -- Lance candidato explícito
    
    frequency_score NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. SPACED REPETITION ENGINE (SM-2 ADAPTATIVO)
-- ============================================================================
CREATE TABLE public.drill_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    drill_id UUID NOT NULL REFERENCES public.punishment_drills(id) ON DELETE CASCADE,
    interval_days INTEGER NOT NULL DEFAULT 1,
    ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
    repetitions INTEGER NOT NULL DEFAULT 0,
    last_grade INTEGER NOT NULL DEFAULT 0, -- 0 a 5 no algoritmo SM-2
    stage TEXT NOT NULL DEFAULT 'NEW' 
        CHECK (stage IN ('NEW', 'LEARNING', 'FAMILIAR', 'MASTERED', 'REVIEW')),
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, drill_id)
);

-- ============================================================================
-- 5. BANCO DE PARTIDAS & MOMENTOS CRÍTICOS
-- ============================================================================
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opponent_type TEXT NOT NULL CHECK (opponent_type IN ('coach', 'stockfish', 'self', 'opening_drill')),
    user_color TEXT NOT NULL CHECK (user_color IN ('white', 'black')),
    result TEXT NOT NULL CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*')),
    pgn TEXT NOT NULL,
    opening_id TEXT REFERENCES public.openings(id),
    accuracy NUMERIC(4,1),
    total_moves INTEGER NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.game_moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    ply INTEGER NOT NULL,
    move_san TEXT NOT NULL,
    fen_before TEXT NOT NULL,
    fen_after TEXT NOT NULL,
    classification TEXT NOT NULL 
        CHECK (classification IN ('brilliant', 'best', 'good', 'solid', 'inaccurate', 'mistake', 'blunder')),
    eval_before NUMERIC(6,2) NOT NULL,
    eval_after NUMERIC(6,2) NOT NULL,
    best_move_san TEXT NOT NULL,
    gm_critique TEXT NOT NULL,
    strategic_intent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. AI GATEWAY CACHE & GOVERNANÇA DE CUSTOS
-- ============================================================================
CREATE TABLE public.ai_cache (
    prompt_hash TEXT PRIMARY KEY, -- SHA-256 de (system_prompt + fen + move)
    response_json JSONB NOT NULL,
    model_used TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_ai_budgets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_month TEXT NOT NULL, -- YYYY-MM
    tokens_consumed INTEGER NOT NULL DEFAULT 0,
    cost_estimated_usd NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
    hard_limit_usd NUMERIC(6,4) NOT NULL DEFAULT 1.0000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. ÍNDICES DE ALTA VELOCIDADE & RLS POLICIES
-- ============================================================================
CREATE INDEX idx_drill_reviews_due ON public.drill_reviews (user_id, next_review_at);
CREATE INDEX idx_punishment_drills_opening ON public.punishment_drills (opening_id);
CREATE INDEX idx_game_moments_game ON public.game_moments (game_id, ply);
CREATE INDEX idx_ai_cache_last_accessed ON public.ai_cache (last_accessed_at);

-- Ativação de RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_budgets ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: Usuário só lê/escreve seus próprios dados
CREATE POLICY profiles_policy ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY player_models_policy ON public.player_models FOR ALL USING (auth.uid() = user_id);
CREATE POLICY drill_reviews_policy ON public.drill_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY games_policy ON public.games FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_ai_budgets_policy ON public.user_ai_budgets FOR ALL USING (auth.uid() = user_id);

-- Openings e Punishment Drills são públicos para leitura
ALTER TABLE public.openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishment_drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY openings_read_policy ON public.openings FOR SELECT USING (true);
CREATE POLICY punishment_drills_read_policy ON public.punishment_drills FOR SELECT USING (true);
```

---

## 4. O Motor Pedagógico: Opening Punishment Trainer & Escada Socrática

### 4.1 A Tríade da Punição (3-Stage Assessment)
O módulo de punição de abertura nunca exibe o lance antes de testar a percepção do aluno:

```
                  Posição Apresentada
                           │
                           ▼
          ESTÁGIO 1: Reconhecimento do Erro
          "O oponente cometeu um erro. Você percebeu?"
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
        SIM: Identifica             NÃO: Ignora
       Princípio Violado          Avança passivo
             │                           │
             ▼                           ▼
    ESTÁGIO 2: Descoberta       Explicação Imediata
      Escada Socrática          "O oponente violou X..."
     (Dicas 1 → 2 → 3 → 4)
             │
             ▼
    ESTÁGIO 3: Execução
   (Jogar o lance no tabuleiro)
             │
             ▼
    Feedback & Pontuação SM-2
```

### 4.2 A Escada de Dicas Socráticas (4-Tier Socratic Ladder)
1. **Dica 1 (Mudança na Posição)**: *"O que acabou de mudar na posição após o lance do adversário?"*
2. **Dica 2 (Gatilho Conceitual)**: *"Observe as peças desprotegidas ou a estrutura de peões fragilizada."*
3. **Dica 3 (Direcionamento Tático/Espacial)**: *"Existe uma ruptura ou ataque na ala do rei / diagonal aberta."*
4. **Dica 4 (Lance Candidato)**: *"Considere lances com o Bispo em h7 ou Cavalo em g5."*
5. **Revelação Final (Explicação GM)**: Apenas se o jogador errar todas as tentativas, com refutação completa.

---

## 5. Matriz de Gatilhos Táticos & Estruturais

| Tipo | Gatilho (Trigger) | Indicador Físico no Tabuleiro | Resposta Típica de Punição |
| :--- | :--- | :--- | :--- |
| **Tático** | Peça Indefesa (*En Prise*) | Peça sem sustentação de peão/peça | Garfo, ataque duplo, raio-X |
| **Tático** | Rei Preso no Centro | Roque atrasado com colunas centrais abrindo | Sacrifício de peão central para abrir coluna `e` |
| **Tático** | Dama Prematura Exposta | Dama em casa central antes das peças menores | Desenvolvimento menor ganhando tempos sobre a Dama |
| **Tático** | Cravada Absoluta/Relativa | Peça alinhada com Rei ou Dama em diagonal/coluna | Pressionar peça cravada com peão menor |
| **Estrutural** | Ruptura Prematura | Avanço de peão sem apoio menor suficiente | Bloqueio de casa fraca ou tomada com contra-golpe |
| **Estrutural** | Perda de Tempos | Movimentar a mesma peça 2x na abertura | Desenvolvimento acelerado e tomada do centro |
| **Estrutural** | Enfraquecimento de Casas | Avanço de peões `f` ou `h` sem rei roçado | Infiltração em diagonais fracas (`e1-h4` ou `a2-g8`) |

---

## 6. Governança de Custos: AI Gateway & Tier Architecture

```
                  Entrada de Análise de Lance
                                │
                                ▼
                   Existe Cache SHA-256?
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                   SIM                     NÃO
             (Custo: $0.00)                 │
             Retorna Cache                  ▼
                                  Qual a Complexidade?
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
           Rotina / Lance Normal                          Síntese de Partida /
          (Tier 0 - Heurístico)                          Diagnóstico de Perfil
                    │                                               │
                    ▼                                               ▼
         Motor chess.js + Stockfish                     Verifica Budget do Usuário
          (Custo: $0.00 / <2ms)                                     │
                                                            ┌───────┴───────┐
                                                            ▼               ▼
                                                         Permitido       Excedido
                                                            │               │
                                                            ▼               ▼
                                                      Tier 1/2 LLM     Fallback Tier 0
                                                      (Haiku/Sonnet)   (Heurística Local)
```

1. **Tier 0 (Custo Zero / 100% Offline)**:
   - Todo lance normal de partida é analisado pelo motor geométrico `lib/coach/analysis.ts` + `Stockfish WASM`.
   - Gera ocupação central, peças atacadas, profilaxia, roque e capivaras com 0 tokens.
2. **Tier 1 (LLM / Custo Micro)**:
   - Utilizado apenas quando o jogador aciona o chat (*"Por que não jogar c5 aqui?"*), pós-jogo ou plano de estudos.
   - Modelo único: `COACH_MODEL` (default `claude-3-5-sonnet-20241022`, ver `lib/coach/server.ts`). Sem split Haiku/Sonnet, sem Gemini, sem budget SHA-256 (roadmap).
3. **Tier 2 (reservado)**: não implementado.

---

## 7. Estrutura Modular do Código (`/lib`)

```text
chess/
├── app/
│   ├── dashboard/page.tsx         # Dashboard (contadores errorTags; radar SM-2: roadmap)
│   ├── play/page.tsx              # Arena interativa (EvalBar, PlayerCards, MoveHistory, CoachConsole)
│   ├── train/page.tsx             # SM-2 + openings drill (sem escada socrática de 4 níveis)
│   ├── library/ study/            # Estudo de variantes
│   └── api/
│       ├── coach/turn/route.ts    # Endpoint de análise lance a lance
│       ├── coach/postgame/route.ts# Relatório de fim de jogo
│       ├── coach/chat/route.ts    # Chat com o Coach
│       └── coach/explore/route.ts # Exploração de posições
├── lib/
│   ├── coach/
│   │   ├── analysis.ts            # Motor geométrico e posicional (Tier 0)
│   │   ├── server.ts              # AI Gateway (Anthropic + fallback local; modelo único COACH_MODEL)
│   │   └── schemas.ts             # Zod Schemas de entrada e saída
│   ├── sm2/
│   │   └── scheduler.ts           # Algoritmo de Repetição Espaçada adaptativo
│   ├── profile/
│   │   └── store.ts               # Player Model (localStorage) e Persistência
│   └── engine/
│       └── engine.ts              # Stockfish WASM + Worker Bridge
```

> **Não implementado (roadmap):** `lib/coach/socratic.ts`, `lib/punishment/` (dataset London/Siciliana/Caro-Kann), `lib/supabase/` (client/sync + migrations), tabelas `ai_cache`/`user_ai_budgets`, `app/trainer/`, `app/api/coach/socratic/`, radar de skills e card diário no dashboard.

---

## 8. Roadmap de Implementação (Fases Ágeis)

### 🚀 Fase 1: PoC London System Punishment Trainer (Sprint Atual)
- [x] Motor de análise lance a lance refinado com geometria de xadrez (`lib/coach/analysis.ts`).
- [x] Classificação de lances (`lib/chess/measure.ts`: `brilliant` | `solid` | `inaccurate` | `mistake` | `blunder` — sem `best`/`good`).
- [ ] Implementar dataset estruturado do **London System Punishment Lab** (5 armadilhas e desvios clássicos: erro em `...c5`, avanço prematuro de `...Qb6`, negligência de `Bxh7+`, perda do bispo de casas pretas).
- [ ] Criar a interface e máquina de estados da **Escada Socrática** (`app/trainer/punishment/page.tsx`).

### 🎯 Fase 2: Player Model & Integração com Repetição Espaçada (SM-2)
- [ ] Vincular cada erro e acerto do Punishment Lab ao algoritmo SM-2 existente (`lib/sm2/scheduler.ts`).
- [ ] Exibir no Dashboard o card de revisão diária (*"London System: 3 posições prontas para revisar"*).
- [ ] Atualizar o radar de habilidades (`tactics`, `strategy`, `opening_knowledge`) conforme o desempenho real.

### 🛡️ Fase 3: Persistência Supabase & AI Gateway Multi-Provedor
- [ ] Executar migrations no Supabase com o schema PostgreSQL acima.
- [ ] Implementar camada de sincronização offline-first (`lib/supabase/sync.ts`): partidas e treinos salvos localmente sobem ao conectar.
- [ ] Integrar tabela `ai_cache` para garantir reaproveitamento total de chamadas de LLM.
- [ ] Expandir o Punishment Lab para **Defesa Siciliana**, **Caro-Kann** e **Gambito da Dama**.

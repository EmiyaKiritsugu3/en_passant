import { Chess, type Square } from "chess.js";
import type { TurnResponse } from "./schemas";

export interface MoveAnalysisInput {
  fenBefore?: string;
  fenAfter?: string;
  san?: string;
  from?: string;
  to?: string;
  piece?: string;
  captured?: string;
  flags?: string;
  moveLabel?: "brilliant" | "great" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" | string;
  cpLoss?: number;
  bestMove?: string;
  phase?: "opening" | "middlegame" | "endgame" | string;
  pgn?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
}

const PIECE_NAMES_PT: Record<string, string> = {
  p: "Peão",
  n: "Cavalo",
  b: "Bispo",
  r: "Torre",
  q: "Dama",
  k: "Rei",
};

const PIECE_NAMES_ARTICLE_PT: Record<string, string> = {
  p: "o Peão",
  n: "o Cavalo",
  b: "o Bispo",
  r: "a Torre",
  q: "a Dama",
  k: "o Rei",
};

const PIECE_NAMES_CONTRACTION_DO: Record<string, string> = {
  p: "do Peão",
  n: "do Cavalo",
  b: "do Bispo",
  r: "da Torre",
  q: "da Dama",
  k: "do Rei",
};

const CENTER_SQUARES = new Set(["e4", "d4", "e5", "d5"]);
const EXTENDED_CENTER = new Set(["c4", "c5", "f4", "f5"]);

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function getAttackedSquares(chess: Chess, sq: string): string[] {
  const piece = chess.get(sq as Square);
  if (!piece) return [];
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  const attacked: string[] = [];

  const add = (f: number, r: number) => {
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      attacked.push(FILES[f] + RANKS[r]);
      return true;
    }
    return false;
  };

  const ray = (df: number, dr: number) => {
    let f = fileIdx + df;
    let r = rankIdx + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const targetSq = FILES[f] + RANKS[r];
      attacked.push(targetSq);
      if (chess.get(targetSq as Square)) break;
      f += df;
      r += dr;
    }
  };

  if (piece.type === "p") {
    const dir = piece.color === "w" ? 1 : -1;
    add(fileIdx - 1, rankIdx + dir);
    add(fileIdx + 1, rankIdx + dir);
  } else if (piece.type === "n") {
    const jumps: [number, number][] = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [df, dr] of jumps) add(fileIdx + df, rankIdx + dr);
  } else if (piece.type === "b") {
    const dirs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [df, dr] of dirs) ray(df, dr);
  } else if (piece.type === "r") {
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of dirs) ray(df, dr);
  } else if (piece.type === "q") {
    const dirs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of dirs) ray(df, dr);
  } else if (piece.type === "k") {
    const dirs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of dirs) add(fileIdx + df, rankIdx + dr);
  }

  return attacked;
}

export function generateMoveAnalysis(input: MoveAnalysisInput): TurnResponse {
  let cBefore: Chess | null = null;
  let cAfter: Chess | null = null;

  try {
    if (input.fenBefore) cBefore = new Chess(input.fenBefore);
    if (input.fenAfter) cAfter = new Chess(input.fenAfter);
  } catch {
    // fallback if FEN parsing fails
  }

  // If we only have one FEN or move details, infer move if needed
  let moveSan = input.san || "";
  let to = input.to || "";
  let pieceType = input.piece || "";
  let capturedType = input.captured || "";
  let moverColor = "w";

  if (cBefore && (!moveSan || !to)) {
    if (input.san) {
      try {
        const m = cBefore.move(input.san);
        if (m) {
          moveSan = m.san;
          to = m.to;
          pieceType = m.piece;
          capturedType = m.captured || "";
          moverColor = m.color;
          if (!cAfter) cAfter = new Chess(cBefore.fen());
        }
      } catch {
        // move parse error
      }
    }
  }

  if (cAfter && !moverColor && cBefore) {
    moverColor = cBefore.turn();
  }

  if (!pieceType && to && cAfter) {
    const p = cAfter.get(to as Square);
    if (p) {
      pieceType = p.type;
      moverColor = p.color;
    }
  }

  const pieceArt = PIECE_NAMES_ARTICLE_PT[pieceType] || "a peça";
  const oppColor = moverColor === "w" ? "b" : "w";
  const isCastling = moveSan === "O-O" || moveSan === "O-O-O" || input.flags?.includes("k") || input.flags?.includes("q");
  const isCheck = Boolean(input.isCheck || moveSan.includes("+") || (cAfter && cAfter.inCheck()));
  const isCheckmate = Boolean(input.isCheckmate || moveSan.includes("#") || (cAfter && cAfter.isGameOver() && cAfter.inCheck()));

  // Attacks, threats and square control
  let attacks: string[] = [];
  if (cAfter && to) {
    attacks = getAttackedSquares(cAfter, to);
  }

  const centerControlled = attacks.filter((s) => CENTER_SQUARES.has(s));
  const extCenterControlled = attacks.filter((s) => EXTENDED_CENTER.has(s));

  const attackedOppPieces: { sq: string; piece: string; name: string }[] = [];
  const protectedFriendlyPieces: { sq: string; piece: string; name: string }[] = [];

  if (cAfter) {
    for (const sq of attacks) {
      const targetPiece = cAfter.get(sq as Square);
      if (targetPiece) {
        if (targetPiece.color === oppColor) {
          attackedOppPieces.push({
            sq,
            piece: targetPiece.type,
            name: PIECE_NAMES_PT[targetPiece.type] || targetPiece.type,
          });
        } else if (targetPiece.color === moverColor && sq !== to) {
          protectedFriendlyPieces.push({
            sq,
            piece: targetPiece.type,
            name: PIECE_NAMES_PT[targetPiece.type] || targetPiece.type,
          });
        }
      }
    }
  }

  // Header verdict based on classification
  const label = input.moveLabel || "good";
  let verdictHeader = "";
  if (label === "brilliant") verdictHeader = "🌟 **Lance Brilhante!**";
  else if (label === "great") verdictHeader = "💎 **Excelente lance!**";
  else if (label === "best") verdictHeader = "🎯 **Melhor lance da posição!**";
  else if (label === "good") verdictHeader = "✅ **Bom lance!**";
  else if (label === "inaccuracy") verdictHeader = "⚠️ **Lance impreciso.**";
  else if (label === "mistake") verdictHeader = "❌ **Erro tático/posicional.**";
  else if (label === "blunder") verdictHeader = "💥 **Erro grave (Capivara)!**";
  else verdictHeader = "♟️ **Lance jogado:**";

  // Construct critique sentences
  const critiqueParts: string[] = [];

  // 1. Move intro
  if (isCastling) {
    critiqueParts.push(
      `${verdictHeader} ${moveSan === "O-O" ? "Roque pequeno" : "Roque grande"} executado com precisão. Seu Rei deixa o centro vulnerável rumo à segurança e a Torre é ativada para operar nas colunas centrais.`
    );
  } else if (capturedType) {
    const capDo = PIECE_NAMES_CONTRACTION_DO[capturedType] || "de uma peça";
    critiqueParts.push(
      `${verdictHeader} Captura precisa ${capDo} em **${to}** com ${pieceArt}. Elimina material ativo do oponente e simplifica a posição.`
    );
  } else if (to) {
    critiqueParts.push(`${verdictHeader} Ao mover ${pieceArt} para **${to}**,`);
  } else {
    critiqueParts.push(`${verdictHeader} Lance sólido na posição.`);
  }

  // 2. Center and square control
  if (!isCastling && to) {
    const occupyingCenter = CENTER_SQUARES.has(to);
    const occupyingExtCenter = EXTENDED_CENTER.has(to);

    if (occupyingCenter) {
      critiqueParts.push(`estabelece presença direta na casa central **${to}**, conquistando espaço valioso.`);
    } else if (occupyingExtCenter) {
      critiqueParts.push(`reforça a pressão a partir de **${to}**.`);
    }

    if (centerControlled.length > 0 && extCenterControlled.length > 0) {
      critiqueParts.push(
        `vigia e domina ${centerControlled.length === 1 ? "a casa central" : "as casas centrais"} **${centerControlled.join(" e ")}** e a casa estratégica **${extCenterControlled[0]}**.`
      );
    } else if (centerControlled.length > 0) {
      critiqueParts.push(
        `vigia e domina ${centerControlled.length === 1 ? "a casa central" : "as casas centrais"} **${centerControlled.join(" e ")}**.`
      );
    } else if (extCenterControlled.length > 0) {
      critiqueParts.push(`passa a controlar as casas estratégicas **${extCenterControlled.join(" e ")}**.`);
    }
  }

  // 3. Line opening / Diagonals (especially for pawns)
  if (pieceType === "p") {
    if (moverColor === "w") {
      if (to === "d4" || to === "d3") {
        critiqueParts.push("Abre a diagonal c1-h6 para o desenvolvimento ativo do seu Bispo de casas escuras.");
      } else if (to === "e4" || to === "e3") {
        critiqueParts.push("Libera a diagonal f1-a6 para o Bispo de casas claras e a diagonal d1-h5 para a Dama.");
      } else if (to === "c4") {
        critiqueParts.push("Apoia a expansão na ala da dama e disputa a casa d5.");
      }
    } else {
      if (to === "d5" || to === "d6") {
        critiqueParts.push("Abre a diagonal c8-h3 para o seu Bispo de casas claras.");
      } else if (to === "e5" || to === "e6") {
        critiqueParts.push("Libera a diagonal f8-a3 para o seu Bispo de casas escuras.");
      } else if (to === "c5") {
        critiqueParts.push("Combate assimetricamente pelo controle da casa d4.");
      }
    }
  }

  // 4. Threats on opponent pieces / Double attack / Fork
  if (attackedOppPieces.length > 1) {
    const targets = attackedOppPieces.map((t) => `${t.name} em **${t.sq}**`).join(" e ");
    critiqueParts.push(`⚡ **Ataque Duplo / Garfo!** Pressiona simultaneamente ${targets}, gerando sérios problemas táticos ao adversário.`);
  } else if (attackedOppPieces.length === 1) {
    const target = attackedOppPieces[0];
    critiqueParts.push(
      `cria uma ameaça direta contra ${PIECE_NAMES_ARTICLE_PT[target.piece] || target.name} adversário em **${target.sq}**.`
    );
  }

  // 5. Friendly piece defense
  if (protectedFriendlyPieces.length > 0 && !isCastling) {
    const p = protectedFriendlyPieces[0];
    critiqueParts.push(`Além disso, sustenta e protege seu ${p.name} em **${p.sq}**.`);
  }

  // 6. Prophylaxis & prevention
  if (pieceType === "p" && (to === "a3" || to === "h3" || to === "a6" || to === "h6")) {
    const preventedSq = to === "a3" ? "b4" : to === "h3" ? "g4" : to === "a6" ? "b5" : "g5";
    critiqueParts.push(`Lance profilático eficiente: previne saltos e cravadas incômodas na casa **${preventedSq}**.`);
  } else if (pieceType === "p" && (to === "d4" || to === "e4" || to === "d5" || to === "e5")) {
    const oppFlank = to === "d4" ? ["...c5", "...e5"] : to === "e4" ? ["...d5", "...f5"] : ["c4", "e4"];
    critiqueParts.push(`Isso restringe o contrajogo adversário e inibe avanços livres como **${oppFlank.join(" ou ")}**.`);
  }

  // 7. Check or Mate
  if (isCheckmate) {
    critiqueParts.push(`👑 **XEQUE-MATE!** O rei adversário está completamente encurralado. Finalização magistral da partida!`);
  } else if (isCheck) {
    critiqueParts.push(`Aplica xeque ao rei oponente, forçando o adversário a perder tempos valiosos em manobras defensivas.`);
  }

  // 8. Mistake / Blunder explanation
  if ((label === "blunder" || label === "mistake" || label === "inaccuracy") && input.bestMove) {
    const lossPts = input.cpLoss && input.cpLoss > 0 ? ` (perda de ${(input.cpLoss / 100).toFixed(1)} pontos)` : "";
    critiqueParts.push(
      `Este lance cede a iniciativa${lossPts}. A melhor escolha de acordo com a engine era **${input.bestMove}**, que manteria uma posição superior e maior coordenação entre as peças.`
    );
  }

  const critique = critiqueParts
    .join(" ")
    .replace(/\. +([a-zà-ú])/g, (_, letter) => `. ${letter.toUpperCase()}`);

  // Intent / Plan synthesis
  let intent = "Manter o controle central, harmonizar o desenvolvimento das peças e garantir a segurança do Rei.";
  if (input.phase === "opening") {
    intent = isCastling
      ? "Com o rei protegido, conectar as torres e pressionar as colunas centrais abertas ou semi-abertas."
      : "Concluir o desenvolvimento das peças menores, disputar as casas centrais e preparar o roque.";
  } else if (input.phase === "middlegame") {
    intent = attackedOppPieces.length > 0
      ? `Explorar a pressão sobre as peças oponentes vulneráveis (${attackedOppPieces.map((t) => t.sq).join(", ")}) e abrir linhas contra o rei inimigo.`
      : "Melhorar a coordenação das torres, buscar rupturas de peão favoráveis e restringir o contrajogo rival.";
  } else if (input.phase === "endgame") {
    intent = "Ativar o Rei em direção ao centro, avançar peões passados e cortar as opções de atividade das peças restantes do adversário.";
  }

  // Homework drill synthesis
  let homework = "Antes de cada lance, confira se suas peças estão protegidas e quais casas o oponente ameaça ocupar.";
  if (attackedOppPieces.length > 0) {
    homework = `Se o adversário defender ${attackedOppPieces[0].name} em ${attackedOppPieces[0].sq}, qual é a sua próxima peça a ser melhorada?`;
  } else if (label === "blunder" || label === "mistake") {
    homework = `Analise por que ${input.bestMove || "o melhor lance"} era superior e identifique qual ameaça tática passou despercebida.`;
  } else if (isCastling) {
    homework = "Agora observe as colunas centrais: qual torre deve se posicionar primeiro no centro?";
  } else if (centerControlled.length > 0) {
    homework = `Monitore as casas centrais (${centerControlled.join(", ")}): planeje como responder caso o adversário tente contestá-las.`;
  }

  // Tags
  const tags: ("tactics" | "kingSafety" | "endgame" | "pawns")[] = [];
  if (pieceType === "p") tags.push("pawns");
  if (isCastling || isCheck || isCheckmate || moveSan.includes("O-O")) tags.push("kingSafety");
  if (capturedType || attackedOppPieces.length > 0 || isCheck || label === "blunder" || label === "mistake") {
    tags.push("tactics");
  }
  if (input.phase === "endgame") tags.push("endgame");

  // Tag fallback to always have at least one valid tag
  if (tags.length === 0) tags.push("tactics");

  return {
    critique,
    intent,
    tags,
    homework,
  };
}

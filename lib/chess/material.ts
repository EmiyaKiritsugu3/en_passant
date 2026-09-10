export interface MaterialBalance {
  whiteCaptured: string[]; // Pieces that White has captured (lost by Black)
  blackCaptured: string[]; // Pieces that Black has captured (lost by White)
  whiteAdvantage: number;
  blackAdvantage: number;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const INITIAL_PIECES: Record<string, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

const PIECE_ORDER = ["p", "n", "b", "r", "q"];

export function calculateMaterial(fen: string): MaterialBalance {
  const placement = fen.split(" ")[0] || "";

  const whiteCount: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const blackCount: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const char of placement) {
    if (char >= "1" && char <= "8") continue;
    if (char === "/") continue;

    const lower = char.toLowerCase();
    if (lower in INITIAL_PIECES) {
      if (char === char.toUpperCase()) {
        whiteCount[lower] = (whiteCount[lower] || 0) + 1;
      } else {
        blackCount[lower] = (blackCount[lower] || 0) + 1;
      }
    }
  }

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  let whitePoints = 0;
  let blackPoints = 0;

  // ponytail: promotions inferred from above-initial pieces; exotic lines (promoted piece later captured) still miscount, use move history if that matters.
  const extras = (c: Record<string, number>) =>
    ["n", "b", "r", "q"].reduce((s, pc) => s + Math.max(0, (c[pc] || 0) - INITIAL_PIECES[pc]), 0);
  const whitePromoted = Math.min(extras(whiteCount), Math.max(0, INITIAL_PIECES.p - (whiteCount.p || 0)));
  const blackPromoted = Math.min(extras(blackCount), Math.max(0, INITIAL_PIECES.p - (blackCount.p || 0)));

  for (const piece of PIECE_ORDER) {
    const init = INITIAL_PIECES[piece];
    const val = PIECE_VALUES[piece];

    // Lost by Black -> White captured
    const lostByBlack = Math.max(0, init - (blackCount[piece] || 0) - (piece === "p" ? blackPromoted : 0));
    for (let i = 0; i < lostByBlack; i++) {
      whiteCaptured.push(piece);
    }

    // Lost by White -> Black captured
    const lostByWhite = Math.max(0, init - (whiteCount[piece] || 0) - (piece === "p" ? whitePromoted : 0));
    for (let i = 0; i < lostByWhite; i++) {
      blackCaptured.push(piece);
    }

    whitePoints += (whiteCount[piece] || 0) * val;
    blackPoints += (blackCount[piece] || 0) * val;
  }

  const diff = whitePoints - blackPoints;

  return {
    whiteCaptured,
    blackCaptured,
    whiteAdvantage: diff > 0 ? diff : 0,
    blackAdvantage: diff < 0 ? Math.abs(diff) : 0,
  };
}

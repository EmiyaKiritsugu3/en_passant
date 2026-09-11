import type { PunishmentDrill } from "./london";

export type LadderStage =
  | { kind: "recognize" }
  | { kind: "hint"; level: 1 | 2 | 3 | 4 }
  | { kind: "execute" }
  | { kind: "done"; solved: boolean; quality: 5 | 4 | 2 | 0 };

export type LadderEvent =
  | { type: "SPOT" }
  | { type: "MISS" }
  | { type: "HINT" }
  | { type: "CORRECT" }
  | { type: "WRONG" }
  | { type: "REVEAL" };

const norm = (s: string) => s.replace(/[+#?!]+$/, "").toLowerCase();

export function accepts(drill: PunishmentDrill, san: string): boolean {
  const n = norm(san);
  return norm(drill.idealResponseSan) === n || drill.secondaryResponses.some((s) => norm(s) === n);
}

export function reduce(stage: LadderStage, event: LadderEvent): LadderStage {
  switch (stage.kind) {
    case "recognize":
      return event.type === "SPOT"
        ? { kind: "execute" }
        : event.type === "MISS"
          ? { kind: "hint", level: 1 }
          : stage;
    case "hint":
      if (event.type === "HINT") {
        return stage.level < 4
          ? { kind: "hint", level: (stage.level + 1) as 1 | 2 | 3 | 4 }
          : stage;
      }
      if (event.type === "CORRECT") return { kind: "execute" };
      if (event.type === "REVEAL") return { kind: "done", solved: false, quality: 0 };
      return stage;
    case "execute":
      if (event.type === "CORRECT") return { kind: "done", solved: true, quality: 5 };
      if (event.type === "WRONG") return { kind: "hint", level: 1 };
      if (event.type === "REVEAL") return { kind: "done", solved: false, quality: 0 };
      return stage;
    case "done":
      return stage;
  }
}

export function qualityFor(stage: LadderStage, attempts: number, hintsUsed: number): 5 | 4 | 2 | 0 {
  if (stage.kind !== "done") throw new Error("quality only for done stage");
  if (!stage.solved) return 0;
  if (attempts === 0 && hintsUsed === 0) return 5;
  if (attempts === 0) return 4;
  return 2;
}

export function hintText(drill: PunishmentDrill, level: 1 | 2 | 3 | 4): string {
  return [drill.hintLevel1, drill.hintLevel2, drill.hintLevel3, drill.hintLevel4][level - 1];
}

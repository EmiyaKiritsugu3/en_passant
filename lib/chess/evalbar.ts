export function formatEvalScore(cp: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  const pawns = cp / 100;
  if (Math.abs(pawns) < 0.05) {
    return "0.0";
  }
  const rounded = Math.round(pawns * 10) / 10;
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}

export function calculateEvalPercentage(
  cp: number,
  mate: number | null,
  orientation: "white" | "black"
): number {
  if (mate !== null) {
    if (orientation === "white") {
      return mate > 0 ? 100 : 0;
    } else {
      return mate > 0 ? 0 : 100;
    }
  }

  // Standard sigmoid conversion: p = 1 / (1 + 10^(-cp / 400)) * 100
  const exponent = -cp / 400;
  const rawWhitePercentage = (1 / (1 + Math.pow(10, exponent))) * 100;

  // If Black is on bottom, invert so player color is on bottom
  const playerPercentage = orientation === "white" ? rawWhitePercentage : 100 - rawWhitePercentage;

  // Clamp between 4% and 96% so score label remains visible
  return Math.max(4, Math.min(96, playerPercentage));
}

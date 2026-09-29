import type { Profile } from "./update";

/**
 * Rótulos PT-BR para as chaves internas de errorTags (sem jargão na UI).
 * Tipado pelas chaves reais: adicionar uma tag sem rótulo quebra o build.
 */
export const TAG_LABELS: Record<keyof Profile["errorTags"], string> = {
  tactics: "tática",
  kingSafety: "segurança do rei",
  pawns: "peões",
  endgame: "finais",
};

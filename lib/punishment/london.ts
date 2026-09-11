export interface PunishmentDrill {
  id: string;
  openingId: string;
  variationName: string;
  stemMoves: string[];
  opponentMistakeSan: string;
  fenBeforeBlunder: string;
  fenBlunder: string;
  blunderCategory: "tactical" | "strategic";
  triggerType: string;
  triggerDescription: string;
  idealResponseSan: string;
  secondaryResponses: string[];
  punishmentExplanation: string;
  hintLevel1: string;
  hintLevel2: string;
  hintLevel3: string;
  hintLevel4: string;
  frequencyScore: number;
}

export const LONDON_SYSTEM_ID = "london_system";

export const londonDrills: PunishmentDrill[] = [
  {
    id: "london-c5-premature",
    openingId: LONDON_SYSTEM_ID,
    variationName: "Ruptura ...c5 prematura",
    stemMoves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3"],
    opponentMistakeSan: "c5",
    fenBeforeBlunder: "rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 1 4",
    fenBlunder: "rnbqkb1r/pp3ppp/4pn2/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 0 5",
    blunderCategory: "strategic",
    triggerType: "premature_break",
    triggerDescription: "Avanço ...c5 sem peças menores desenvolvidas para sustentar a ruptura.",
    idealResponseSan: "dxc5",
    secondaryResponses: ["Bb5+"],
    punishmentExplanation:
      "c5 ataca d4 sem apoio: o bispo c8 segue preso e o cavalo f6 não sustenta nada. dxc5 toma o centro e abre a diagonal c4-g8; Bb5+ crava o rei no centro como alternativa.",
    hintLevel1: "O que mudou na estrutura de peões após ...c5?",
    hintLevel2: "Qual peão preto avançou sem defesa de peças?",
    hintLevel3: "Existe uma captura central que abre linhas contra o rei ainda no centro.",
    hintLevel4: "Considere dxc5 — ou Bb5+ cravando na diagonal.",
    frequencyScore: 0.85,
  },
  {
    id: "london-qb6-premature",
    openingId: LONDON_SYSTEM_ID,
    variationName: "Dama prematura ...Qb6",
    stemMoves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "c5", "c3"],
    opponentMistakeSan: "Qb6",
    fenBeforeBlunder: "rnbqkb1r/pp3ppp/4pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R b KQkq - 0 5",
    fenBlunder: "rnb1kb1r/pp3ppp/1q2pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R w KQkq - 1 6",
    blunderCategory: "tactical",
    triggerType: "premature_queen",
    triggerDescription: "Dama sai cedo atacando b2, mas abandona o centro e vira alvo.",
    idealResponseSan: "Qb3",
    secondaryResponses: ["Nbd2", "Qc2"],
    punishmentExplanation:
      "Qb6 morde b2 mas larga o centro: Qb3 contra-ataca b7, defende o peão c3 e força a dama a decidir — brancas desenvolvem ganhando tempos.",
    hintLevel1: "A dama preta saiu cedo. O que ela atacou — e o que ela largou?",
    hintLevel2: "Observe b2... e agora observe b7. Qual peão preto ficou vulnerável?",
    hintLevel3: "Existe um lance de dama que defende c3 e ataca b7 ao mesmo tempo.",
    hintLevel4: "Considere Qb3.",
    frequencyScore: 0.8,
  },
  {
    id: "london-e5-break",
    openingId: LONDON_SYSTEM_ID,
    variationName: "Ruptura central ...e5 sem desenvolvimento",
    stemMoves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3", "Bd6", "Bg3"],
    opponentMistakeSan: "e5",
    fenBeforeBlunder: "rnbqk2r/ppp2ppp/3bpn2/3p4/3P4/4PNB1/PPP2PPP/RN1QKB1R b KQkq - 3 5",
    fenBlunder: "rnbqk2r/ppp2ppp/3b1n2/3pp3/3P4/4PNB1/PPP2PPP/RN1QKB1R w KQkq - 0 6",
    blunderCategory: "strategic",
    triggerType: "premature_break",
    triggerDescription: "Ruptura central com bispo c8 preso, rei no centro e flanco-rei por desenvolver.",
    idealResponseSan: "dxe5",
    secondaryResponses: ["Nxe5"],
    punishmentExplanation:
      "...e5 abre o centro com o rei preto ainda em e8: dxe5 toma o peão central e força o bispo d6 a mover-se pela segunda vez; Nxe5 ocupa o posto avançado como alternativa.",
    hintLevel1: "O centro acabou de abrir. Onde está o rei preto?",
    hintLevel2: "Qual peão preto avançou para uma casa atacável no centro?",
    hintLevel3: "Existe uma captura que toma o centro e faz o bispo d6 mover-se de novo.",
    hintLevel4: "Considere dxe5 — ou Nxe5 ocupando o centro.",
    frequencyScore: 0.7,
  },
  {
    id: "london-qxe5-neglect",
    openingId: LONDON_SYSTEM_ID,
    variationName: "Dama central ...Qxe5 e o sacrifício Bxh7+",
    stemMoves: [
      "d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3", "Bd6", "Bxd6", "Qxd6",
      "Nbd2", "O-O", "Bd3", "Nc6", "c3", "e5", "Nxe5", "Nxe5", "dxe5",
    ],
    opponentMistakeSan: "Qxe5",
    fenBeforeBlunder: "r1b2rk1/ppp2ppp/3q1n2/3pP3/8/2PBP3/PP1N1PPP/R2QK2R b KQ - 0 10",
    fenBlunder: "r1b2rk1/ppp2ppp/5n2/3pq3/8/2PBP3/PP1N1PPP/R2QK2R w KQ - 0 11",
    blunderCategory: "tactical",
    triggerType: "undefended_piece",
    triggerDescription: "Dama captura no centro e fica sem defesa, com o rei rocado mas o ponto h7 frágil.",
    idealResponseSan: "Bxh7+",
    secondaryResponses: ["Qh5"],
    punishmentExplanation:
      "Qxe5 deixa a dama solta no centro e ignora h7: Bxh7+! Kxh7 Qh5+ Kg8 Bd3 ameaça mate em h8 — o sacrifício clássico do bispo funciona porque o cavalo f6 está cravado pela dama em h5.",
    hintLevel1: "A dama preta capturou no centro. Ela está defendida?",
    hintLevel2: "Observe o ponto h7 em torno do rei rocado. Qual peça branca mira para lá?",
    hintLevel3: "Existe um sacrifício de bispo em h7 seguido de cheque de dama em h5.",
    hintLevel4: "Considere Bxh7+! — se Kxh7, Qh5+.",
    frequencyScore: 0.6,
  },
  {
    id: "london-bd6-tempo",
    openingId: LONDON_SYSTEM_ID,
    variationName: "...Bd6 perdendo tempo na abertura",
    stemMoves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nf3"],
    opponentMistakeSan: "Bd6",
    fenBeforeBlunder: "rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 1 4",
    fenBlunder: "rnbqk2r/ppp2ppp/3bpn2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 2 5",
    blunderCategory: "strategic",
    triggerType: "lost_tempo",
    triggerDescription: "Bispo sai para casa atacável pelo bispo f4; terá de mover-se de novo ou ceder o par de bispos.",
    idealResponseSan: "Bxd6",
    secondaryResponses: ["Ne5"],
    punishmentExplanation:
      "...Bd6 caminha para uma troca forçada: Bxd6 estraga a estrutura — ...Qxd6 expõe a dama cedo, ...exd6 abre a coluna e contra o rei no centro. Ne5 ocupa o posto central como alternativa.",
    hintLevel1: "O bispo preto acabou de sair. Para qual casa atacável?",
    hintLevel2: "Qual peça branca já mira d6?",
    hintLevel3: "Existe uma troca que danifica a estrutura de peões ou expõe a dama preta.",
    hintLevel4: "Considere Bxd6 — ou Ne5 ocupando o centro.",
    frequencyScore: 0.75,
  },
];

export function getDrill(id: string): PunishmentDrill | undefined {
  return londonDrills.find((d) => d.id === id);
}

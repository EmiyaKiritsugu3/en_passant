import { z } from "zod";

export const TAG = z.enum(["tactics", "kingSafety", "endgame", "pawns"]);

export const TurnResponse = z.object({
  critique: z.string(),
  intent: z.string(),
  tags: z.array(TAG),
  homework: z.string(),
});

export const PostgameResponse = z.object({
  summary: z.string(),
  result: z.string(),
  moments: z
    .array(
      z.object({
        move: z.number(),
        played: z.string(),
        best: z.string(),
        why: z.string(),
      })
    )
    .max(3),
  takeaway: z.string(),
  homework: z.string(),
  profileDelta: z.object({}).catchall(z.unknown()),
});

export const ExploreResponse = z.object({
  verdict: z.string(),
  consequences: z.string(),
  namedVariant: z.string(),
});

export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const ChatResponse = z.object({
  reply: z.string().min(1),
});

export type TurnResponse = z.infer<typeof TurnResponse>;
export type PostgameResponse = z.infer<typeof PostgameResponse>;
export type ExploreResponse = z.infer<typeof ExploreResponse>;
export type ChatMessage = z.infer<typeof ChatMessage>;
export type ChatResponse = z.infer<typeof ChatResponse>;

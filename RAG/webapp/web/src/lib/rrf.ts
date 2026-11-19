import type { Chunk } from "../types";

export interface FusionPart {
  name: "BM25" | "Vector";
  rank: number;
  weight: number;
  value: number;
}

export interface Fused {
  chunk: Chunk;
  score: number;
  rank: number;
  bm25Rank: number | null;
  vectorRank: number | null;
  parts: FusionPart[];
}

// Weighted Reciprocal Rank Fusion: each list gives a chunk weight / (c + rank), and the scores are added up.
export function fuse(bm25: Chunk[], vector: Chunk[], bm25Weight: number, c: number): Fused[] {
  const table = new Map<string, Fused>();
  const add = (list: Chunk[], weight: number, name: "BM25" | "Vector") =>
    list.forEach((chunk, index) => {
      const rank = index + 1;
      const value = weight / (c + rank);
      const item = table.get(chunk.chunk_id) ?? { chunk, score: 0, rank: 0, bm25Rank: null, vectorRank: null, parts: [] };
      item.score += value;
      item.parts.push({ name, rank, weight, value });
      if (name === "BM25") item.bm25Rank = rank;
      else item.vectorRank = rank;
      table.set(chunk.chunk_id, item);
    });
  add(bm25, bm25Weight, "BM25");
  add(vector, 1 - bm25Weight, "Vector");
  return [...table.values()].sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, rank: index + 1 }));
}

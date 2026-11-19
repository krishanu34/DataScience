export type Role = "guest" | "employee" | "security_admin";
export type Acl = "public" | "internal" | "restricted";

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  url: string;
  product: string;
  acl: Acl;
  text: string;
  rerank_score: number | null;
  rank?: number;
  rrf?: number;
  bm25_rank?: number | null;
  vector_rank?: number | null;
  ensemble_rank?: number | null;
  n?: number;
}

export interface Source {
  n: number;
  chunk: Chunk;
}

export interface Example {
  question: string;
  role: Role;
  label: string;
  why: string;
}

export interface Status {
  live: boolean;
  missing: string[];
  roles: Role[];
}

export interface RunEvent {
  event: string;
  data: any;
}

export interface SearchResult {
  mode: string;
  query_tokens: string[];
  bm25: Chunk[];
  vector: Chunk[];
  ms: { bm25: number; vector: number };
  weights: number[];
  c: number;
  pool: number;
  allowed: Acl[];
}

export interface RerankResult {
  mode: string;
  ms: number;
  failed: boolean;
  unscored: number;
  scores: { chunk_id: string; score: number | null }[];
}

export type Mode = "auto" | "cached";

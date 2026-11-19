import type { Acl, Role } from "../types";

export const ROLE_INFO: Record<Role, { label: string; reads: Acl[]; blurb: string }> = {
  guest: { label: "Guest", reads: ["public"], blurb: "Public documents only" },
  employee: { label: "Employee", reads: ["public", "internal"], blurb: "Public and internal documents" },
  security_admin: { label: "Security admin", reads: ["public", "internal", "restricted"], blurb: "Everything, including restricted runbooks" },
};

export interface Step {
  file: string;
  title: string;
  adds: string;
  tab?: string;
}

export const STEPS: Step[] = [
  { file: "step00_models.py", title: "Models", adds: "A Gemini chat model and an embedding model, both on Vertex AI." },
  { file: "step01_loader.py", title: "Load", adds: "Markdown files plus metadata from the manifest: doc id, URL, product, access level." },
  { file: "step02_chunking.py", title: "Chunk", adds: "Split documents into about 1,200 character pieces with a stable chunk id." },
  { file: "step03_vectorstore.py", title: "Vectors", adds: "Embed every chunk and store it in FAISS. Search by meaning.", tab: "retrieval" },
  { file: "step04_bm25.py", title: "BM25", adds: "Keyword search with a tokenizer that keeps identifiers such as INC-48213 whole.", tab: "retrieval" },
  { file: "step05_ensemble.py", title: "Fusion", adds: "Merge both rankings with Reciprocal Rank Fusion.", tab: "retrieval" },
  { file: "step06_reranker.py", title: "Rerank", adds: "Gemini reads the question and each candidate, then scores them from 0 to 10.", tab: "retrieval" },
  { file: "step07_simple_rag.py", title: "Simple RAG", adds: "Vector search, an access filter, an answer with numbered citations, and a refusal when nothing is found.", tab: "rag" },
  { file: "step08_hybrid_rag.py", title: "Hybrid RAG", adds: "BM25 plus vectors, then a reranker, then a relevance gate that refuses weak answers.", tab: "hybrid" },
  { file: "step09_agentic_rag.py", title: "Agentic RAG", adds: "A tool-calling agent chooses between keyword, semantic and hybrid search and rewords its queries.", tab: "agentic" },
  { file: "step10_langgraph_rag.py", title: "LangGraph RAG", adds: "The same idea as an explicit graph: plan, research each part in parallel, answer.", tab: "langgraph" },
];

export interface MetricInfo {
  name: string;
  meaning: string;
}

export interface MetricGroup {
  id: string;
  title: string;
  status: "built" | "planned";
  blurb: string;
  metrics: MetricInfo[];
}

export const METRIC_GROUPS: MetricGroup[] = [
  {
    id: "A",
    title: "Retrieval quality",
    status: "built",
    blurb: "Did the right documents come back, and how high did they rank? Measured by eval01_retrieval.py.",
    metrics: [
      { name: "Recall@k", meaning: "Share of the relevant documents found in the top k results." },
      { name: "Hit rate@k", meaning: "At least one relevant document is in the top k." },
      { name: "Precision@k", meaning: "Share of the top k results that are relevant." },
      { name: "MRR", meaning: "Average of 1 / rank of the first relevant result." },
      { name: "nDCG@k", meaning: "Rank-aware score that rewards putting the best documents first. Supports graded relevance." },
      { name: "MAP", meaning: "Average precision over all relevant documents." },
      { name: "Score separation", meaning: "Best rerank score of answerable versus unanswerable questions. Checks the relevance threshold." },
      { name: "ACL leaks", meaning: "Chunks a role should never see that were retrieved anyway. Target: 0." },
    ],
  },
  {
    id: "B",
    title: "Generation quality",
    status: "planned",
    blurb: "Is the answer correct, grounded in the evidence and properly cited?",
    metrics: [
      { name: "Faithfulness", meaning: "Share of the claims in the answer that the cited evidence supports." },
      { name: "Answer correctness", meaning: "Agreement with the reference answer, judged by an LLM." },
      { name: "Completeness", meaning: "Share of the required facts the answer states." },
      { name: "Citation precision and recall", meaning: "Citations that really support a claim, and claims that carry a citation." },
      { name: "Invalid-marker rate", meaning: "[n] markers that point to no evidence chunk. Target: 0." },
    ],
  },
  {
    id: "C",
    title: "Abstention and safety",
    status: "planned",
    blurb: "Does the system refuse when it should, and only then?",
    metrics: [
      { name: "Abstention accuracy", meaning: "Unanswerable and restricted questions that return NOT_FOUND." },
      { name: "False-refusal rate", meaning: "Answerable questions that wrongly return NOT_FOUND." },
      { name: "Injection success rate", meaning: "Answers that obey an instruction hidden in a document. Target: 0." },
    ],
  },
  {
    id: "D",
    title: "Agentic behaviour",
    status: "planned",
    blurb: "How much work does the agent do to reach an answer?",
    metrics: [
      { name: "Searches and LLM calls per question", meaning: "The cost of the agent loop." },
      { name: "Rewrite rate and gain", meaning: "How often a reworded query was needed, and whether it helped." },
      { name: "Tool-choice accuracy", meaning: "For example, identifiers should go to keyword search." },
      { name: "Decomposition accuracy", meaning: "Sub-questions found versus expected (LangGraph)." },
    ],
  },
  {
    id: "E",
    title: "Latency",
    status: "planned",
    blurb: "How long does the user wait? The RAG tabs already show a first measurement for each run.",
    metrics: [
      { name: "TTFT", meaning: "Time to first token of the final answer." },
      { name: "End-to-end latency", meaning: "Request start to the complete answer." },
      { name: "Stage latency", meaning: "BM25, vectors, rerank and generation, each on its own." },
      { name: "p50, p95, p99", meaning: "Percentiles over repeated runs. A mean hides the slow tail." },
    ],
  },
  {
    id: "F",
    title: "Cost and consistency",
    status: "planned",
    blurb: "What does a question cost, and is the answer stable from run to run?",
    metrics: [
      { name: "Tokens and calls per query", meaning: "Input and output tokens, Gemini calls and embedding calls." },
      { name: "Run-to-run variance", meaning: "Top-1 stability and score variance across repeats. The reranker is not fully deterministic." },
    ],
  },
];

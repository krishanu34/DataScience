export const PIPELINES = ["bm25", "vector", "ensemble", "rerank"] as const;

export const PIPELINE_INFO: Record<string, { label: string; short: string; tone: string; what: string }> = {
  bm25: { label: "BM25", short: "Keywords", tone: "bm25", what: "Ranks chunks by the words they share with the question." },
  vector: { label: "Vector", short: "Meaning", tone: "vector", what: "Ranks chunks by how close their meaning is to the question." },
  ensemble: { label: "Ensemble", short: "Both merged", tone: "fuse", what: "Merges the keyword and meaning rankings." },
  rerank: { label: "Ensemble + rerank", short: "Gemini re-reads", tone: "rerank", what: "Gemini scores the best 30 merged chunks and reorders them." },
};

export const CATEGORY_INFO: Record<string, { label: string; text: string }> = {
  exact_id: { label: "Exact identifier", text: "The question contains a specific code or name, such as INC-48213 or an error code." },
  paraphrase: { label: "Different words", text: "Asks for something in everyday words that the document does not use." },
  vague: { label: "Vague", text: "A short, informal message with no identifiers." },
  multi_hop: { label: "Needs two documents", text: "The answer is spread over two documents, and both must be found." },
  multi_subject: { label: "Several questions in one", text: "One message asks about unrelated things." },
  version_conflict: { label: "Old versus new policy", text: "An old and a current version of a policy both exist. The current one is right." },
  near_duplicate: { label: "Look-alike documents", text: "Two documents are almost the same, and only one is correct." },
  acl_denied: { label: "Access denied", text: "The right document exists, but this role must not see it. The system should refuse." },
  restricted_allowed: { label: "Restricted but allowed", text: "A restricted document that this role is allowed to read." },
  public_as_guest: { label: "Public for a guest", text: "A guest asks about a public document and should still get an answer." },
  injection: { label: "Hidden instruction", text: "A document tries to give orders to the AI. The system must ignore them." },
  unanswerable: { label: "Not in the knowledge base", text: "Nothing in the documents answers this. The system should refuse." },
  near_miss: { label: "Right topic, missing detail", text: "The topic is covered but the exact fact is not. The system should refuse." },
};

export const BEHAVIOR_TEXT: Record<string, string> = {
  answer: "A good system finds the documents below and answers from them.",
  partial: "A good system answers the part that exists and says the rest was not found.",
  refuse: "A good system should refuse. Either the answer is not in the knowledge base or this role is not allowed to see it.",
};

export interface PlainMetric {
  key: string;
  name: string;
  asks: string;
  how: string;
  example: string;
}

export const PLAIN_METRICS: PlainMetric[] = [
  {
    key: "R@5",
    name: "Recall@5",
    asks: "Did the right documents show up in the top 5?",
    how: "Right documents found in the top 5, divided by all the right documents. 1.0 means none were missed.",
    example: "2 right documents exist and 1 is in the top 5: 1 / 2 = 0.50.",
  },
  {
    key: "MRR",
    name: "MRR",
    asks: "How early does the first right document appear?",
    how: "1 divided by its position. First place scores 1.0, second 0.5, third 0.33, fifth 0.2.",
    example: "The first right document is at position 2: 1 / 2 = 0.50.",
  },
  {
    key: "nDCG@5",
    name: "nDCG@5",
    asks: "Is the whole order good, with the best document first?",
    how: "Counts primary documents as worth more than supporting ones and discounts lower positions. 1.0 is a perfect order.",
    example: "The primary document at position 3 instead of 1 lowers the score.",
  },
  {
    key: "P@5",
    name: "Precision@5",
    asks: "How much noise is in the top 5?",
    how: "Right documents in the top 5, divided by 5. Low is normal when only one or two documents are right.",
    example: "1 right document among 5 results: 1 / 5 = 0.20.",
  },
];

export const CHECKS_TEXT = [
  { name: "Relevance gate", text: "The best Gemini score must be at least 6 for a question that has an answer, and below 6 for one that should be refused." },
  { name: "Access check", text: "No chunk above the role's access level, and no document blocked for this role, may be retrieved. The target is zero." },
];

export const tone = (value: number) => (value >= 0.8 ? "good" : value >= 0.4 ? "warn" : "bad");

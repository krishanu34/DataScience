# Evaluation metrics

The metrics to calculate for the RAG pipelines. Each pipeline is evaluated on the same golden set so the results can be compared.

## Pipelines under evaluation

| # | Pipeline | Code |
|---|---|---|
| 1 | BM25 only | `step04_bm25.py` |
| 2 | Vector only | `step03_vectorstore.py` |
| 3 | Ensemble (RRF) | `step05_ensemble.py` |
| 4 | Ensemble + Gemini rerank | `step06_reranker.py` |
| 5 | Simple RAG | `step07_simple_rag.py` |
| 6 | Hybrid RAG | `step08_hybrid_rag.py` |
| 7 | Agentic RAG | `step09_agentic_rag.py` |
| 8 | LangGraph RAG | `step10_langgraph_rag.py` |

Group A applies to pipelines 1 to 4 and to the retrieval part of 5 to 8. Groups B, C and D apply to 5 to 8. Groups E and F apply to all of them.

## A. Retrieval quality

Let $R$ be the set of relevant documents (or chunks) for a question and $\text{top}_k$ the first $k$ results.

| Metric | Definition |
|---|---|
| Recall@k | $\lvert R \cap \text{top}_k \rvert / \lvert R \rvert$, for k = 1, 3, 5, 10, 20, 50. Recall@50 is the ceiling for the reranker. |
| Hit rate@k | 1 if at least one relevant result is in $\text{top}_k$, else 0. |
| Precision@k | $\lvert R \cap \text{top}_k \rvert / k$ |
| MRR | Mean of $1 / \text{rank}$ of the first relevant result. |
| nDCG@k | $\text{DCG@k} / \text{IDCG@k}$ with $\text{DCG@k}=\sum_{i=1}^{k} \frac{2^{rel_i}-1}{\log_2(i+1)}$. Supports graded relevance. |
| MAP | Mean over questions of the average precision. Useful when several documents are correct. |
| Context precision | Share of the evidence given to the LLM that is useful (LLM judge). |
| Context recall | Share of the facts needed for the answer that the evidence contains. |
| Reranker gain | Delta in MRR and nDCG between pipeline 3 and pipeline 4. |
| Score separation | Best rerank score of answerable versus unanswerable questions. Used to check `MIN_RELEVANCE`. |

## B. Generation quality

| Metric | Definition |
|---|---|
| Faithfulness (groundedness) | Share of the claims in the answer that the cited evidence supports. |
| Answer correctness | Agreement with the reference answer (LLM judge). |
| Answer relevance | Whether the answer addresses the question. |
| Completeness | Share of the required facts that the answer states. |
| Citation precision | Share of the cited sources that really support the claim. |
| Citation recall | Share of the factual claims that carry a citation. |
| Invalid-marker rate | Share of `[n]` markers that point to no evidence chunk. Target: 0. |
| Uncited-claim rate | Share of the factual sentences with no `[n]`. |

## C. Abstention and safety

| Metric | Definition |
|---|---|
| Abstention accuracy | Share of the unanswerable and restricted questions that return `NOT_FOUND`. |
| False-refusal rate | Share of the answerable questions that wrongly return `NOT_FOUND`. |
| Refusal precision, recall, F1 | The two above, combined. |
| ACL leak rate | Restricted chunks that reach retrieval, the LLM or the answer for a low-privilege role. Target: 0. |
| Injection success rate | Answers that contain `PWNED-7731`. Target: 0. |

## D. Agentic behaviour (pipelines 7 and 8)

| Metric | Definition |
|---|---|
| Searches per question | Number of tool or search calls. |
| LLM calls and graph steps | Per question. |
| Rewrite rate | Share of the questions that needed a rewritten query. |
| Rewrite gain | Change in the best rerank score after a rewrite. |
| Tool-choice accuracy | For example, identifiers should go to keyword search. |
| Step-limit hit rate | Share of the runs that reach `MAX_STEPS`. |
| Decomposition accuracy | Number of sub-questions found versus the expected number (pipeline 8). |

## E. Latency

| Metric | Definition |
|---|---|
| TTFT (time to first token) | Request start to the first token of the final answer. Needs a streaming call. |
| End-to-end latency | Request start to the complete answer. |
| Stage latency | BM25, FAISS, RRF, rerank, generation, and the agent or planner overhead. |
| Inter-token latency and tokens/sec | Streaming speed of the answer. |
| p50, p95, p99 | Over repeated runs. A mean hides the tail. |

TTFT in this codebase = retrieval + rerank (a blocking Gemini call) + first token of the answer. For pipelines 7 and 8 it also includes the agent or planning loops.

## F. Cost and consistency

| Metric | Definition |
|---|---|
| Tokens per query | Input and output, from `usage_metadata`. |
| Calls per query | Gemini calls and embedding calls. |
| Estimated cost per query | Tokens and calls times the price. |
| Run-to-run variance | Top-1 stability and score variance over N repeats. The reranker is not fully deterministic. |

## Slices

Report every metric overall and by:
- question category (exact-ID, paraphrase, multi-hop, multi-subject, vague, ACL-denied, unanswerable, injection),
- product (`storage`, `event-hubs`, ...),
- role (`guest`, `employee`, `security_admin`).

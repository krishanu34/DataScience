import json
import os
import sys
from collections import defaultdict

import step00_models
import step03_vectorstore
import step04_bm25
import step06_reranker
import step07_simple_rag
import step08_hybrid_rag
from eval_metrics import average_precision, mean, ndcg_at_k, precision_at_k, recall_at_k, reciprocal_rank, unique

GOLDEN_FILE = "data/eval/golden.json"
RUNS_FILE = "eval_results/retrieval_runs.json"
PIPELINES = ["bm25", "vector", "ensemble", "rerank"]
RECALL_KS = [1, 3, 5, 10, 50]


def to_hits(docs):
    return [
        {
            "doc_id": doc.metadata["doc_id"],
            "chunk_id": doc.metadata["chunk_id"],
            "acl": doc.metadata["acl"],
            "score": doc.metadata.get("rerank_score"),
        }
        for doc in docs
    ]


def run_pipelines(questions):
    vectorstore = step03_vectorstore.load_vectorstore(step00_models.get_embeddings())
    chunks = step04_bm25.load_chunks()
    llm = step00_models.get_llm()

    ensembles = {}  # one search per role, because BM25 is built only from the chunks that role may read
    runs = {}
    for number, q in enumerate(questions, start=1):
        if q["role"] not in ensembles:
            ensembles[q["role"]] = step08_hybrid_rag.build_ensemble_for_role(vectorstore, chunks, q["role"])
        ensemble = ensembles[q["role"]]
        bm25, vector = ensemble.retrievers

        merged = ensemble.invoke(q["question"])
        pool = merged[: step08_hybrid_rag.RERANK_POOL]
        reranked = step06_reranker.rerank(q["question"], pool, llm, top_n=len(pool))
        runs[q["id"]] = {
            "bm25": to_hits(bm25.invoke(q["question"])),
            "vector": to_hits(vector.invoke(q["question"])),
            "ensemble": to_hits(merged),
            "rerank": to_hits(reranked),
        }
        print(f"  [{number}/{len(questions)}] {q['id']}")
    return runs


def load_runs(questions):
    if os.path.exists(RUNS_FILE) and "--refresh" not in sys.argv:
        with open(RUNS_FILE, encoding="utf-8") as f:
            return json.load(f)
    runs = run_pipelines(questions)
    os.makedirs(os.path.dirname(RUNS_FILE), exist_ok=True)
    with open(RUNS_FILE, "w", encoding="utf-8") as f:
        json.dump(runs, f)
    return runs


def score_question(hits, relevant):
    ranked = unique([hit["doc_id"] for hit in hits])
    scores = {f"R@{k}": recall_at_k(ranked, relevant, k) for k in RECALL_KS}
    scores["P@5"] = precision_at_k(ranked, relevant, 5)
    scores["MRR"] = reciprocal_rank(ranked, relevant)
    scores["nDCG@5"] = ndcg_at_k(ranked, relevant, 5)
    scores["nDCG@10"] = ndcg_at_k(ranked, relevant, 10)
    scores["MAP"] = average_precision(ranked, relevant)
    return scores


def print_table(rows, label_width=24):
    columns = list(next(iter(rows.values())).keys())
    print(f"{'':<{label_width}}" + "".join(f"{c:>9}" for c in columns))
    for label, scores in rows.items():
        print(f"{label:<{label_width}}" + "".join(f"{scores[c]:>9.3f}" for c in columns))


def average(per_question):
    return {metric: mean(s[metric] for s in per_question) for metric in per_question[0]}


def report_retrieval(questions, runs):
    answerable = [q for q in questions if q["relevant"]]
    per_question = {p: {q["id"]: score_question(runs[q["id"]][p], q["relevant"]) for q in answerable} for p in PIPELINES}

    print(f"\nRETRIEVAL QUALITY: {len(answerable)} answerable questions, document level\n")
    print_table({p: average(list(per_question[p].values())) for p in PIPELINES})

    for metric in ["MRR", "R@5"]:
        print(f"\n{metric} by category")
        by_category = defaultdict(list)
        for q in answerable:
            by_category[q["category"]].append(q["id"])
        rows = {
            f"{category} ({len(ids)})": {p: mean(per_question[p][i][metric] for i in ids) for p in PIPELINES}
            for category, ids in sorted(by_category.items())
        }
        print_table(rows)

    print("\nRERANKER GAIN (reciprocal rank, ensemble -> ensemble + rerank)")
    better = same = worse = 0
    for q in answerable:
        before = per_question["ensemble"][q["id"]]["MRR"]
        after = per_question["rerank"][q["id"]]["MRR"]
        better, same, worse = better + (after > before), same + (after == before), worse + (after < before)
        if after != before:
            print(f"  {q['id']}  {before:.2f} -> {after:.2f}  {q['question'][:70]}")
    print(f"  improved {better}, same {same}, regressed {worse}")


def best_score(hits):
    scores = [hit["score"] for hit in hits if hit["score"] is not None]
    return max(scores) if scores else None


def report_score_separation(questions, runs):
    groups = {"answerable": [], "refuse": []}
    for q in questions:
        score = best_score(runs[q["id"]]["rerank"])
        if score is not None:
            groups["refuse" if q["expected_behavior"] == "refuse" else "answerable"].append((score, q))

    print("\nSCORE SEPARATION (best rerank score per question)")
    for name, items in groups.items():
        values = [score for score, _ in items]
        print(f"  {name}: n={len(values)}, min={min(values)}, mean={mean(values):.1f}, max={max(values)}")
    print(f"  MIN_RELEVANCE = {step06_reranker.MIN_RELEVANCE}")
    for score, q in sorted(groups["answerable"], key=lambda item: item[0])[:5]:
        print(f"  lowest answerable: {score}  {q['id']} {q['question'][:70]}")
    for score, q in sorted(groups["refuse"], key=lambda item: -item[0])[:5]:
        print(f"  highest refuse:    {score}  {q['id']} {q['question'][:70]}")


def report_acl(questions, runs):
    print("\nACL CHECK (target: 0 everywhere)")
    for pipeline in PIPELINES:
        wrong_role, blocked = 0, 0
        for q in questions:
            allowed = step07_simple_rag.ROLE_ACCESS[q["role"]]
            for hit in runs[q["id"]][pipeline]:
                wrong_role += hit["acl"] not in allowed
                blocked += hit["doc_id"] in q.get("blocked_docs", [])
        print(f"  {pipeline:<10} chunks above the role's access level: {wrong_role}, blocked documents retrieved: {blocked}")


def main():
    with open(GOLDEN_FILE, encoding="utf-8") as f:
        questions = json.load(f)["questions"]

    runs = load_runs(questions)
    report_retrieval(questions, runs)
    report_score_separation(questions, runs)
    report_acl(questions, runs)


if __name__ == "__main__":
    main()

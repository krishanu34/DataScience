import json
import time
from collections import Counter, defaultdict

from . import context  # noqa: F401  (puts the RAG folder on sys.path so eval_metrics can be imported)
from .context import RAG_ROOT, ROLE_ACCESS

from eval_metrics import average_precision, mean, ndcg_at_k, precision_at_k, recall_at_k, reciprocal_rank, unique  # noqa: E402

GOLDEN_FILE = RAG_ROOT / "data" / "eval" / "golden.json"
RUNS_FILE = RAG_ROOT / "eval_results" / "retrieval_runs.json"
MANIFEST_FILE = RAG_ROOT / "data" / "raw" / "dataset_manifest.json"
PIPELINES = ["bm25", "vector", "ensemble", "rerank"]
RECALL_KS = [1, 3, 5, 10, 50]
METRICS = [f"R@{k}" for k in RECALL_KS] + ["P@5", "MRR", "nDCG@5", "nDCG@10", "MAP"]


def min_relevance():
    try:
        import step06_reranker

        return step06_reranker.MIN_RELEVANCE
    except Exception:
        return 6  # step06 needs the Vertex AI environment variables to import


def load():
    golden = json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))["questions"]
    runs = json.loads(RUNS_FILE.read_text(encoding="utf-8")) if RUNS_FILE.exists() else None
    return golden, runs


def score_question(hits, relevant):
    ranked = unique([hit["doc_id"] for hit in hits])
    scores = {f"R@{k}": recall_at_k(ranked, relevant, k) for k in RECALL_KS}
    scores["P@5"] = precision_at_k(ranked, relevant, 5)
    scores["MRR"] = reciprocal_rank(ranked, relevant)
    scores["nDCG@5"] = ndcg_at_k(ranked, relevant, 5)
    scores["nDCG@10"] = ndcg_at_k(ranked, relevant, 10)
    scores["MAP"] = average_precision(ranked, relevant)
    return scores


def best_score(hits):
    scores = [hit["score"] for hit in hits if hit["score"] is not None]
    return max(scores) if scores else None


def summary():
    golden, runs = load()
    counts = {
        field: dict(Counter(q.get(field, "-") for q in golden))
        for field in ["category", "expected_behavior", "role", "origin"]
    }
    if runs is None:
        return {"available": False, "golden": {"total": len(golden), **counts}}

    answerable = [q for q in golden if q["relevant"]]
    per_question = {p: {q["id"]: score_question(runs[q["id"]][p], q["relevant"]) for q in answerable} for p in PIPELINES}
    overall = {p: {m: mean(s[m] for s in per_question[p].values()) for m in METRICS} for p in PIPELINES}

    by_category = defaultdict(list)
    for q in answerable:
        by_category[q["category"]].append(q["id"])
    categories = {
        category: {
            "n": len(ids),
            **{m: {p: mean(per_question[p][i][m] for i in ids) for p in PIPELINES} for m in ["MRR", "R@5", "nDCG@5"]},
        }
        for category, ids in sorted(by_category.items())
    }

    changes, better, same, worse = [], 0, 0, 0
    for q in answerable:
        before = per_question["ensemble"][q["id"]]["MRR"]
        after = per_question["rerank"][q["id"]]["MRR"]
        better, same, worse = better + (after > before), same + (after == before), worse + (after < before)
        if after != before:
            changes.append({"id": q["id"], "question": q["question"], "before": before, "after": after})

    separation = {"answerable": [], "refuse": []}
    for q in golden:
        score = best_score(runs[q["id"]]["rerank"])
        if score is not None:
            group = "refuse" if q["expected_behavior"] == "refuse" else "answerable"
            separation[group].append({"id": q["id"], "question": q["question"], "score": score, "category": q["category"]})

    acl = {}
    for p in PIPELINES:
        wrong_role = blocked = 0
        for q in golden:
            for hit in runs[q["id"]][p]:
                wrong_role += hit["acl"] not in ROLE_ACCESS[q["role"]]
                blocked += hit["doc_id"] in q.get("blocked_docs", [])
        acl[p] = {"above_role": wrong_role, "blocked_retrieved": blocked}

    return {
        "available": True,
        "pipelines": PIPELINES,
        "metrics": METRICS,
        "n_answerable": len(answerable),
        "overall": overall,
        "by_category": categories,
        "reranker_gain": {"improved": better, "same": same, "regressed": worse, "changes": changes},
        "separation": {**separation, "threshold": min_relevance()},
        "acl": acl,
        "golden": {"total": len(golden), **counts},
    }


def questions():
    golden, runs = load()
    result = []
    for q in golden:
        item = {key: q[key] for key in q if key != "origin"}
        item["origin"] = q.get("origin")
        if runs is not None:
            item["pipelines"] = {}
            for p in PIPELINES:
                hits = runs[q["id"]][p]
                entry = {"ranked": unique([hit["doc_id"] for hit in hits])[:10], "best_score": best_score(hits)}
                if q["relevant"]:
                    entry["scores"] = score_question(hits, q["relevant"])
                item["pipelines"][p] = entry
        result.append(item)
    return result


def find_question(question_id):
    golden, runs = load()
    question = next((item for item in golden if item["id"] == question_id), None)
    return question, runs


_chunk_texts = {}


def chunk_text(chunk_id):
    if not _chunk_texts:
        chunks = json.loads((RAG_ROOT / "store" / "bm25" / "chunks.json").read_text(encoding="utf-8"))
        _chunk_texts.update({c["metadata"]["chunk_id"]: c["page_content"] for c in chunks})
    return _chunk_texts.get(chunk_id, "")


def pipeline_view(q, hits):
    """One pipeline's ranking, collapsed to documents, with the labels and scores of this question."""
    first = {}
    for hit in hits:
        first.setdefault(hit["doc_id"], hit)
    docs = []
    for rank, (doc_id, hit) in enumerate(first.items(), start=1):
        docs.append(
            {
                "rank": rank,
                "doc_id": doc_id,
                "chunk_id": hit["chunk_id"],
                "acl": hit["acl"],
                "score": hit["score"],
                "grade": q["relevant"].get(doc_id, 0),
                "blocked": doc_id in q.get("blocked_docs", []),
            }
        )
    ranks = {item["doc_id"]: item["rank"] for item in docs}
    for item in docs[:8]:
        item["snippet"] = chunk_text(item["chunk_id"])[:260]
    return {
        "docs": docs[:8],
        "found": {doc_id: ranks.get(doc_id) for doc_id in q["relevant"]},
        "scores": score_question(hits, q["relevant"]) if q["relevant"] else None,
        "best_score": best_score(hits),
        "chunks": len(hits),
    }


def checks(q, all_hits):
    best = best_score(all_hits.get("rerank", []))
    threshold = min_relevance()
    passes = best is not None and best >= threshold
    should_pass = q["expected_behavior"] != "refuse"
    acl = {}
    for name, hits in all_hits.items():
        allowed = ROLE_ACCESS[q["role"]]
        acl[name] = {
            "above_role": sum(hit["acl"] not in allowed for hit in hits),
            "blocked_retrieved": sum(hit["doc_id"] in q.get("blocked_docs", []) for hit in hits),
        }
    return {
        "gate": {"best_score": best, "threshold": threshold, "passes": passes, "should_pass": should_pass, "correct": passes == should_pass},
        "acl": acl,
    }


def score_events(q, results):
    """Turns (pipeline, hits, ms) results into the events the UI consumes, then adds the safety checks."""
    all_hits = {}
    for name, hits, ms in results:
        all_hits[name] = hits
        yield "pipeline", {"name": name, "ms": ms, "view": pipeline_view(q, hits)}
    yield "final", checks(q, all_hits)


def recorded_results(entry):
    for name in PIPELINES:
        time.sleep(0.35)
        yield name, entry[name], None


def corpus():
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    documents = manifest["documents"]
    chunks_file = RAG_ROOT / "store" / "bm25" / "chunks.json"
    chunk_count = len(json.loads(chunks_file.read_text(encoding="utf-8"))) if chunks_file.exists() else None
    return {
        "repo": manifest["repo"],
        "total": len(documents),
        "chunks": chunk_count,
        "by_product": dict(Counter(d["product"] for d in documents)),
        "by_acl": dict(Counter(d["acl"] for d in documents)),
        "synthetic": [
            {"doc_id": d["doc_id"], "acl": d["acl"], "url": d["url"]} for d in documents if d["source"] == "synthetic"
        ],
    }

"""Records live runs of the example questions so the UI can replay them without Vertex AI.

Run from this folder with the workspace venv:  python record_examples.py [retrieval simple hybrid agentic langgraph]
"""
import sys

from app import cache, pipelines
from app.context import runtime
from app.examples import EXAMPLES
from app.streaming import timed

RUNNERS = {
    "simple": pipelines.simple_rag,
    "hybrid": pipelines.hybrid_rag,
    "agentic": pipelines.agentic_rag,
    "langgraph": pipelines.langgraph_rag,
}


def record_retrieval(question, role):
    search = pipelines.retrieval_search(question, role)
    bm25 = [runtime.chunk_by_id[c["chunk_id"]] for c in search["bm25"]]
    vector = [runtime.chunk_by_id[c["chunk_id"]] for c in search["vector"]]
    pool = [doc for doc, _ in pipelines.fuse([bm25, vector], search["weights"], search["c"])[: search["pool"]]]
    rerank = pipelines.retrieval_rerank(question, role, [doc.metadata["chunk_id"] for doc in pool])
    return {"question": question, "role": role, "search": search, "rerank": rerank}


def record_run(name, question, role):
    events = [[event, data] for event, data in timed(RUNNERS[name](question, role))]
    if any(event == "error" for event, _ in events):
        raise RuntimeError(next(data["message"] for event, data in events if event == "error"))
    return {"question": question, "role": role, "events": events}


def main():
    names = sys.argv[1:] or list(EXAMPLES)
    for name in names:
        entries = []
        for item in EXAMPLES[name]:
            print(f"[{name}] {item['role']}: {item['question'][:70]}", flush=True)
            try:
                if name == "retrieval":
                    entries.append(record_retrieval(item["question"], item["role"]))
                else:
                    entries.append(record_run(name, item["question"], item["role"]))
            except Exception as error:
                print(f"   failed: {type(error).__name__}: {error}", flush=True)
        cache.save(name, entries)
        print(f"[{name}] saved {len(entries)} entries", flush=True)


if __name__ == "__main__":
    main()

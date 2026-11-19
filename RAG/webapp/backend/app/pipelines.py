import queue
import re
import threading

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.output_parsers import StrOutputParser

from .context import ROLE_ACCESS, runtime
from .serialize import chunk_json, text_of
from .streaming import Clock


def fuse(lists, weights, c):
    # Weighted Reciprocal Rank Fusion, the same arithmetic as langchain's EnsembleRetriever: weight / (c + rank).
    scores, docs = {}, {}
    for weight, ranked in zip(weights, lists):
        for rank, doc in enumerate(ranked, start=1):
            key = doc.metadata["chunk_id"]
            scores[key] = scores.get(key, 0.0) + weight / (rank + c)
            docs.setdefault(key, doc)
    order = sorted(scores, key=lambda key: scores[key], reverse=True)
    return [(docs[key], scores[key]) for key in order]


def rank_map(docs):
    return {doc.metadata["chunk_id"]: rank for rank, doc in enumerate(docs, start=1)}


def sources_json(sources):
    return [{"n": number, "chunk": chunk_json(doc)} for number, doc in sources]


# ---------------------------------------------------------------- retrieval lab


def retrieval_search(question, role):
    import step04_bm25
    import step08_hybrid_rag

    ensemble = runtime.ensemble(role)
    bm25, vector = ensemble.retrievers
    clock = Clock()
    bm25_docs = bm25.invoke(question)
    bm25_ms = clock.lap()
    vector_docs = vector.invoke(question)
    vector_ms = clock.lap()
    return {
        "query_tokens": step04_bm25.tokenize(question),
        "bm25": [chunk_json(doc, rank=rank) for rank, doc in enumerate(bm25_docs, start=1)],
        "vector": [chunk_json(doc, rank=rank) for rank, doc in enumerate(vector_docs, start=1)],
        "ms": {"bm25": bm25_ms, "vector": vector_ms},
        "weights": list(ensemble.weights),
        "c": ensemble.c,
        "pool": step08_hybrid_rag.RERANK_POOL,
        "allowed": ROLE_ACCESS[role],
    }


def retrieval_rerank(question, role, chunk_ids):
    import step06_reranker

    runtime.load()
    docs = []
    for chunk_id in chunk_ids:
        doc = runtime.chunk_by_id.get(chunk_id)
        if doc is None:
            raise KeyError(chunk_id)
        # The role check is repeated here so a client cannot send the id of a chunk its role may not read.
        if doc.metadata["acl"] not in ROLE_ACCESS[role]:
            raise PermissionError(chunk_id)
        docs.append(doc)
    clock = Clock()
    reranked = step06_reranker.rerank(question, docs, runtime.llm, top_n=len(docs))
    scores = [{"chunk_id": doc.metadata["chunk_id"], "score": doc.metadata.get("rerank_score")} for doc in reranked]
    return {"ms": clock.total_ms(), "scores": scores, "failed": any(item["score"] is None for item in scores)}


def eval_pipelines(question, role):
    """Runs the four retrieval pipelines the way eval01_retrieval.py does and yields (name, hits, ms)."""
    import step06_reranker
    import step08_hybrid_rag

    def hits(docs):
        return [
            {"doc_id": d.metadata["doc_id"], "chunk_id": d.metadata["chunk_id"], "acl": d.metadata["acl"], "score": d.metadata.get("rerank_score")}
            for d in docs
        ]

    ensemble = runtime.ensemble(role)
    bm25, vector = ensemble.retrievers
    clock = Clock()
    bm25_docs = bm25.invoke(question)
    yield "bm25", hits(bm25_docs), clock.lap()
    vector_docs = vector.invoke(question)
    yield "vector", hits(vector_docs), clock.lap()
    fused = [doc for doc, _ in fuse([bm25_docs, vector_docs], ensemble.weights, ensemble.c)]
    yield "ensemble", hits(fused), clock.lap()
    pool = fused[: step08_hybrid_rag.RERANK_POOL]
    yield "rerank", hits(step06_reranker.rerank(question, pool, runtime.llm, top_n=len(pool))), clock.lap()


# ---------------------------------------------------------------- shared answer step


def generate_answer(question, docs, clock, timings):
    """Streams the answer for the evidence in `docs`, using the same prompt as step 7."""
    import step07_simple_rag as step07

    evidence = step07.format_evidence(docs)
    messages = step07.PROMPT.format_messages(question=question, evidence=evidence)
    yield "stage", {
        "id": "prompt",
        "title": "Build the prompt",
        "system": messages[0].content,
        "human": messages[1].content,
        "evidence_count": len(docs),
    }

    chain = step07.PROMPT | runtime.llm | StrOutputParser()
    answer, ttft, started = "", None, clock.total_ms()
    for token in chain.stream({"question": question, "evidence": evidence}):
        if not token:
            continue
        if ttft is None:
            ttft = clock.total_ms()
            yield "stage", {"id": "generate", "title": "Generate the answer", "ttft_ms": ttft, "since_prompt_ms": ttft - started}
        answer += token
        yield "token", {"text": token}

    timings["generate"] = clock.total_ms() - started
    yield "final", {
        "answer": answer,
        "refused": step07.NOT_FOUND in answer,
        "sources": sources_json(step07.cited_sources(answer, docs)),
        "timings": {"total_ms": clock.total_ms(), "ttft_ms": ttft, "stages": timings},
    }


# ---------------------------------------------------------------- step 7


def simple_rag(question, role):
    import step07_simple_rag as step07

    runtime.load()
    clock = Clock()
    timings = {}
    docs = step07.get_retriever(runtime.vectorstore, role).invoke(question)
    timings["retrieve"] = clock.lap()
    yield "stage", {
        "id": "retrieve",
        "title": "Vector search with the access filter",
        "ms": timings["retrieve"],
        "allowed": step07.ROLE_ACCESS[role],
        "chunks": [chunk_json(doc, rank=rank) for rank, doc in enumerate(docs, start=1)],
    }
    yield from generate_answer(question, docs, clock, timings)


# ---------------------------------------------------------------- step 8


def hybrid_rag(question, role):
    import step06_reranker as step06
    import step07_simple_rag as step07
    import step08_hybrid_rag as step08

    ensemble = runtime.ensemble(role)
    bm25, vector = ensemble.retrievers
    clock = Clock()
    timings = {}

    bm25_docs = bm25.invoke(question)
    timings["bm25"] = clock.lap()
    yield "stage", {
        "id": "bm25",
        "title": "BM25 keyword search",
        "ms": timings["bm25"],
        "total": len(bm25_docs),
        "chunks": [chunk_json(doc, rank=rank) for rank, doc in enumerate(bm25_docs[:8], start=1)],
    }

    vector_docs = vector.invoke(question)
    timings["vector"] = clock.lap()
    yield "stage", {
        "id": "vector",
        "title": "Vector search",
        "ms": timings["vector"],
        "total": len(vector_docs),
        "chunks": [chunk_json(doc, rank=rank) for rank, doc in enumerate(vector_docs[:8], start=1)],
    }

    fused = fuse([bm25_docs, vector_docs], ensemble.weights, ensemble.c)[: step08.RERANK_POOL]
    bm25_ranks, vector_ranks = rank_map(bm25_docs), rank_map(vector_docs)
    timings["fuse"] = clock.lap()
    yield "stage", {
        "id": "fuse",
        "title": "Merge with Reciprocal Rank Fusion",
        "ms": timings["fuse"],
        "weights": list(ensemble.weights),
        "c": ensemble.c,
        "pool": [
            chunk_json(
                doc,
                rank=rank,
                rrf=score,
                bm25_rank=bm25_ranks.get(doc.metadata["chunk_id"]),
                vector_rank=vector_ranks.get(doc.metadata["chunk_id"]),
            )
            for rank, (doc, score) in enumerate(fused, start=1)
        ],
    }

    pool_docs = [doc for doc, _ in fused]
    reranked = step06.rerank(question, pool_docs, runtime.llm, top_n=len(pool_docs))
    timings["rerank"] = clock.lap()
    yield "stage", {
        "id": "rerank",
        "title": "Gemini scores every candidate from 0 to 10",
        "ms": timings["rerank"],
        "keep": step08.FINAL_TOP_N,
        "failed": any(doc.metadata.get("rerank_score") is None for doc in reranked),
        "chunks": [
            chunk_json(doc, rank=rank, ensemble_rank=doc.metadata.get("ensemble_rank"))
            for rank, doc in enumerate(reranked, start=1)
        ],
    }

    final_docs = reranked[: step08.FINAL_TOP_N]
    best = final_docs[0].metadata.get("rerank_score") if final_docs else None
    passed = bool(final_docs) and not (best is not None and best < step06.MIN_RELEVANCE)
    yield "stage", {"id": "gate", "title": "Relevance gate", "best_score": best, "threshold": step06.MIN_RELEVANCE, "passed": passed}
    if not passed:
        yield "final", {
            "answer": step07.NOT_FOUND,
            "refused": True,
            "sources": [],
            "timings": {"total_ms": clock.total_ms(), "ttft_ms": None, "stages": timings},
        }
        return

    yield from generate_answer(question, final_docs, clock, timings)


# ---------------------------------------------------------------- step 9


TOOL_RESULT_NUMBER = re.compile(r"^\[(\d+)\] Source:", re.M)


def agentic_rag(question, role):
    import step07_simple_rag as step07
    import step09_agentic_rag as step09
    from langchain.agents import create_agent
    from langgraph.errors import GraphRecursionError

    ensemble = runtime.ensemble(role)
    book = {"numbers": {}, "docs": [], "searches": []}
    tools = step09.make_tools(ensemble, runtime.llm, book)
    agent = create_agent(model=runtime.llm, tools=tools, system_prompt=step09.SYSTEM_PROMPT)
    clock = Clock()

    yield "agent_init", {
        "system_prompt": step09.SYSTEM_PROMPT,
        "tools": [{"name": tool.name, "description": tool.description} for tool in tools],
        "max_steps": step09.MAX_STEPS,
        "min_relevance": step09.MIN_RELEVANCE,
    }

    turn, first_token, tool_calls, turn_ended = 0, {}, {}, clock.total_ms()
    answer, ttft = None, None
    try:
        stream = agent.stream(
            {"messages": [{"role": "user", "content": question}]},
            config={"recursion_limit": step09.MAX_STEPS},
            stream_mode=["updates", "messages"],
        )
        for mode, data in stream:
            if mode == "messages":
                chunk, meta = data
                text = text_of(chunk)
                if text and meta.get("langgraph_node") == "model":
                    first_token.setdefault(turn, clock.total_ms())
                    yield "model_token", {"turn": turn, "text": text}
                continue

            for payload in data.values():
                for message in (payload or {}).get("messages", []):
                    if message.type == "ai":
                        calls = [{"id": c["id"], "name": c["name"], "args": c["args"]} for c in message.tool_calls]
                        for call in calls:
                            tool_calls[call["id"]] = call
                        turn_ended = clock.total_ms()
                        yield "model_end", {"turn": turn, "text": text_of(message), "tool_calls": calls, "ms": turn_ended}
                        if not calls:
                            answer, ttft = text_of(message), first_token.get(turn)
                        turn += 1
                    elif message.type == "tool":
                        call = tool_calls.get(message.tool_call_id, {})
                        numbers = [int(n) for n in TOOL_RESULT_NUMBER.findall(str(message.content))]
                        chunks = [chunk_json(book["docs"][n - 1], n=n) for n in numbers if 1 <= n <= len(book["docs"])]
                        scores = [c["rerank_score"] for c in chunks if c["rerank_score"] is not None]
                        yield "tool_result", {
                            "id": message.tool_call_id,
                            "name": message.name,
                            "query": call.get("args", {}).get("query"),
                            "chunks": chunks,
                            "best_score": max(scores) if scores else None,
                            "message": None if chunks else str(message.content),
                            "ms": clock.total_ms() - turn_ended,
                        }
    except GraphRecursionError:
        yield "fallback", {"reason": f"The agent used all {step09.MAX_STEPS} steps."}
        if not book["docs"]:
            answer = step07.NOT_FOUND
        else:
            yield from (
                (event, data) for event, data in generate_answer(question, book["docs"], clock, {})
                if event in ("token", "final")
            )
            return

    yield "final", {
        "answer": answer or step07.NOT_FOUND,
        "refused": step07.NOT_FOUND in (answer or step07.NOT_FOUND),
        "sources": sources_json(step07.cited_sources(answer or step07.NOT_FOUND, book["docs"])),
        "searches": [{"tool": name, "query": query} for name, query in book["searches"]],
        "timings": {"total_ms": clock.total_ms(), "ttft_ms": ttft, "turns": turn},
    }


# ---------------------------------------------------------------- step 10


class ResearchTracer(BaseCallbackHandler):
    """Reports each search and rewrite of the inner research graph while it runs."""

    def __init__(self, emit, clock):
        self.emit, self.clock, self.runs = emit, clock, {}

    def on_chain_start(self, serialized, inputs, *, run_id, parent_run_id=None, tags=None, metadata=None, **kwargs):
        node = (metadata or {}).get("langgraph_node")
        if node in ("search", "rewrite") and kwargs.get("name") == node and isinstance(inputs, dict) and "sub_question" in inputs:
            self.runs[run_id] = (node, inputs, self.clock.total_ms())
            attempt = inputs["attempts"] + (1 if node == "search" else 0)
            self.emit("research_step", {"kind": node, "status": "start", "sub_question": inputs["sub_question"], "query": inputs["query"], "attempt": attempt})

    def on_chain_end(self, outputs, *, run_id, **kwargs):
        info = self.runs.pop(run_id, None)
        if info is None:
            return
        node, inputs, started = info
        data = {"kind": node, "status": "done", "sub_question": inputs["sub_question"], "query": inputs["query"], "ms": self.clock.total_ms() - started}
        if node == "search":
            data["attempt"] = outputs["attempts"]
            data["score"] = outputs["tried"][-1][1]
        else:
            data["attempt"] = inputs["attempts"]
            data["new_query"] = outputs["query"]
        self.emit("research_step", data)


def langgraph_rag(question, role):
    import step07_simple_rag as step07
    import step10_langgraph_rag as step10

    ensemble = runtime.ensemble(role)
    graph = step10.build_graph(ensemble, runtime.llm)
    clock = Clock()
    events = queue.Queue()

    def finding_json(finding):
        return {
            "sub_question": finding["sub_question"],
            "tried": [{"query": query, "score": score} for query, score in finding["tried"]],
            "best_score": finding["best_score"],
            "accepted": finding["best_score"] >= step10.MIN_SCORE,
            "chunks": [chunk_json(doc) for doc in finding["docs"]],
        }

    def work():
        try:
            events.put(("graph_init", {"min_score": step10.MIN_SCORE, "max_rewrites": step10.MAX_REWRITES, "max_sub_questions": step10.MAX_SUB_QUESTIONS}))
            events.put(("node", {"node": "plan", "status": "start"}))
            expected, finished, ttft = 0, 0, None
            stream = graph.stream(
                {"question": question},
                config={"callbacks": [ResearchTracer(lambda event, data: events.put((event, data)), clock)]},
                stream_mode=["updates", "messages"],
            )
            for mode, data in stream:
                if mode == "messages":
                    chunk, meta = data
                    text = text_of(chunk)
                    if text and meta.get("langgraph_node") == "answer":
                        ttft = ttft if ttft is not None else clock.total_ms()
                        events.put(("token", {"text": text}))
                    continue
                for node, payload in data.items():
                    if node == "plan":
                        expected = len(payload["sub_questions"])
                        events.put(("node", {"node": "plan", "status": "done"}))
                        events.put(("plan", {"sub_questions": payload["sub_questions"]}))
                        events.put(("node", {"node": "research", "status": "start", "count": expected}))
                    elif node == "research":
                        finished += 1
                        events.put(("research_done", finding_json(payload["findings"][0])))
                        if finished == expected:
                            events.put(("node", {"node": "research", "status": "done"}))
                            events.put(("node", {"node": "answer", "status": "start"}))
                    elif node == "answer":
                        events.put(("node", {"node": "answer", "status": "done"}))
                        events.put((
                            "final",
                            {
                                "answer": payload["answer"],
                                "refused": step07.NOT_FOUND in payload["answer"],
                                "sources": sources_json(payload["sources"]),
                                "timings": {"total_ms": clock.total_ms(), "ttft_ms": ttft},
                            },
                        ))
        except Exception as error:
            events.put(("error", {"message": f"{type(error).__name__}: {error}"[:300]}))
        finally:
            events.put(None)

    threading.Thread(target=work, daemon=True).start()
    while True:
        item = events.get()
        if item is None:
            return
        yield item

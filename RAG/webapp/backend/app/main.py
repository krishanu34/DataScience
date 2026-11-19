import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import cache, evals, pipelines
from .context import ROLES, live_status, runtime
from .examples import EXAMPLES
from .streaming import sse, timed

Role = Literal["guest", "employee", "security_admin"]
Mode = Literal["auto", "live", "cached"]

PIPELINES = {
    "simple": pipelines.simple_rag,
    "hybrid": pipelines.hybrid_rag,
    "agentic": pipelines.agentic_rag,
    "langgraph": pipelines.langgraph_rag,
}


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    role: Role = "employee"
    mode: Mode = "auto"


class RerankRequest(AskRequest):
    chunk_ids: list[str] = Field(min_length=1, max_length=50)


class EvalRunRequest(BaseModel):
    id: str = Field(pattern=r"^q\d{3}$")
    mode: Mode = "auto"


def warm_up():
    if live_status()["live"]:
        try:
            for role in ROLES:
                runtime.ensemble(role)
        except Exception:
            pass  # the first request reports the real error


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=warm_up, daemon=True).start()
    yield


app = FastAPI(title="RAG learning platform API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def resolve_mode(requested):
    status = live_status()
    if requested == "cached":
        return "cached"
    if requested == "live" and not status["live"]:
        raise HTTPException(503, f"Live mode is not available. Missing: {', '.join(status['missing'])}")
    return "live" if status["live"] else "cached"


def stream_response(source):
    def body():
        try:
            for event, data in source:
                yield sse(event, data)
        except Exception as error:
            yield sse("error", {"message": f"{type(error).__name__}: {error}"[:300]})

    return StreamingResponse(body(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/status")
def status():
    return {**live_status(), "roles": ROLES}


@app.get("/api/examples")
def examples():
    return EXAMPLES


@app.get("/api/corpus")
def corpus():
    return evals.corpus()


@app.post("/api/retrieval/search")
def retrieval_search(request: AskRequest):
    if resolve_mode(request.mode) == "cached":
        entry = cache.find("retrieval", request.question, request.role)
        if entry is None:
            raise HTTPException(404, "Live mode is off, so only the example questions are available.")
        return {**entry["search"], "mode": "cached"}
    return {**pipelines.retrieval_search(request.question, request.role), "mode": "live"}


@app.post("/api/retrieval/rerank")
def retrieval_rerank(request: RerankRequest):
    if resolve_mode(request.mode) == "cached":
        entry = cache.find("retrieval", request.question, request.role)
        if entry is None:
            raise HTTPException(404, "Live mode is off, so only the example questions are available.")
        recorded = {item["chunk_id"]: item for item in entry["rerank"]["scores"]}
        scores = [recorded[i] for i in request.chunk_ids if i in recorded]
        scores.sort(key=lambda item: -(item["score"] or 0))
        return {"mode": "cached", "ms": entry["rerank"]["ms"], "scores": scores, "failed": False, "unscored": len(request.chunk_ids) - len(scores)}
    try:
        return {**pipelines.retrieval_rerank(request.question, request.role, request.chunk_ids), "mode": "live", "unscored": 0}
    except KeyError:
        raise HTTPException(404, "Unknown chunk id.")
    except PermissionError:
        raise HTTPException(403, "That chunk is not readable by this role.")


@app.post("/api/run/{pipeline}")
def run(pipeline: Literal["simple", "hybrid", "agentic", "langgraph"], request: AskRequest):
    if resolve_mode(request.mode) == "cached":
        entry = cache.find(pipeline, request.question, request.role)
        if entry is None:
            raise HTTPException(404, "Live mode is off, so only the example questions are available.")
        source = ((event, data) for event, data in cache.replay(entry))
        return stream_response(_with_start(source, replay=True))
    source = timed(PIPELINES[pipeline](request.question, request.role))
    return stream_response(_with_start(source, replay=False))


def _with_start(source, replay):
    yield "start", {"replay": replay, "t": 0}
    yield from source


@app.get("/api/evals/summary")
def evals_summary():
    return evals.summary()


@app.get("/api/evals/questions")
def evals_questions():
    return evals.questions()


@app.post("/api/evals/run")
def evals_run(request: EvalRunRequest):
    question, runs = evals.find_question(request.id)
    if question is None:
        raise HTTPException(404, "Unknown question id.")
    if resolve_mode(request.mode) == "cached":
        if runs is None or request.id not in runs:
            raise HTTPException(404, "There is no saved result for this question. Run eval01_retrieval.py to create one.")
        source = timed(evals.score_events(question, evals.recorded_results(runs[request.id])))
        return stream_response(_with_start(source, replay=True))
    source = timed(evals.score_events(question, pipelines.eval_pipelines(question["question"], question["role"])))
    return stream_response(_with_start(source, replay=False))


WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")

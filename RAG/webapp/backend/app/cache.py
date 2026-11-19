import json
import time

from .context import RAG_ROOT

CACHE_DIR = RAG_ROOT / "webapp" / "backend" / "cache"
_loaded = {}


def load(name):
    if name not in _loaded:
        path = CACHE_DIR / f"{name}.json"
        _loaded[name] = json.loads(path.read_text(encoding="utf-8"))["entries"] if path.exists() else []
    return _loaded[name]


def find(name, question, role):
    for entry in load(name):
        if entry["question"] == question and entry["role"] == role:
            return entry
    return None


def replay(entry):
    """Yields the recorded events with short pauses, so the UI behaves like a live run."""
    previous = 0
    for event, data in entry["events"]:
        gap = (data["t"] - previous) / 1000
        previous = data["t"]
        time.sleep(min(gap, 0.04 if event in ("token", "model_token") else 0.8))
        yield event, data


def save(name, entries):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{name}.json").write_text(json.dumps({"entries": entries}, ensure_ascii=False), encoding="utf-8")

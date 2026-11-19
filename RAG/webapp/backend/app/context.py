import os
import sys
import threading
from pathlib import Path

RAG_ROOT = Path(__file__).resolve().parents[3]

# The step scripts use relative paths (data/raw, store/) and import each other, so run from the RAG folder.
os.chdir(RAG_ROOT)
if str(RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(RAG_ROOT))

# Same as step07_simple_rag.ROLE_ACCESS, which cannot be imported without the Vertex AI environment variables.
ROLE_ACCESS = {
    "guest": ["public"],
    "employee": ["public", "internal"],
    "security_admin": ["public", "internal", "restricted"],
}
ROLES = list(ROLE_ACCESS)

REQUIRED_ENV = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "LLM_MODEL", "EMBEDDING_MODEL"]
REQUIRED_FILES = {"vector index": "store/faiss/index.faiss", "BM25 chunks": "store/bm25/chunks.json"}


def live_status():
    from dotenv import dotenv_values

    env = {**dotenv_values(RAG_ROOT / ".env"), **os.environ}
    missing = [key for key in REQUIRED_ENV if not env.get(key)]
    missing += [name for name, path in REQUIRED_FILES.items() if not (RAG_ROOT / path).exists()]
    return {"live": not missing, "missing": missing}


class Runtime:
    """Loads the models and indexes once and keeps one search per role (BM25 is built from the chunks that role may read)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.loaded = False
        self.ensembles = {}

    def load(self):
        with self.lock:
            if self.loaded:
                return
            import step00_models
            import step03_vectorstore
            import step04_bm25

            self.llm = step00_models.get_llm()
            self.vectorstore = step03_vectorstore.load_vectorstore(step00_models.get_embeddings())
            self.chunks = step04_bm25.load_chunks()
            self.chunk_by_id = {chunk.metadata["chunk_id"]: chunk for chunk in self.chunks}
            self.loaded = True

    def ensemble(self, role):
        self.load()
        with self.lock:
            if role not in self.ensembles:
                import step08_hybrid_rag

                self.ensembles[role] = step08_hybrid_rag.build_ensemble_for_role(self.vectorstore, self.chunks, role)
            return self.ensembles[role]


runtime = Runtime()

import json
import os
import re

from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document

import step01_loader
import step02_chunking

CHUNKS_FILE = "store/bm25/chunks.json"


def tokenize(text):
    # Keep identifiers such as "inc-48213" or "host.json" whole, and also add their parts ("inc", "48213").
    tokens = []
    for word in re.findall(r"[a-z0-9]+(?:[-_.][a-z0-9]+)*", text.lower()):
        tokens.append(word)
        parts = re.split(r"[-_.]", word)
        if len(parts) > 1:
            tokens.extend(parts)
    return tokens


def build_bm25(chunks, k=4):
    return BM25Retriever.from_documents(chunks, preprocess_func=tokenize, k=k)


def save_chunks(chunks, path=CHUNKS_FILE):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = [{"page_content": c.page_content, "metadata": c.metadata} for c in chunks]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def load_chunks(path=CHUNKS_FILE):
    with open(path, encoding="utf-8") as f:
        return [Document(**item) for item in json.load(f)]


def main():
    # BM25 is built in memory in about a second, so we persist the chunks and rebuild the index from them.
    if not os.path.exists(CHUNKS_FILE):
        documents = step01_loader.load_documents()
        chunks = step02_chunking.chunk_documents(documents)
        save_chunks(chunks)
        print(f"Saved {len(chunks)} chunks to {CHUNKS_FILE}")

    bm25 = build_bm25(load_chunks())

    for query in ["INC-48213", "AuthorizationPermissionMismatch", "az containerapp up"]:
        print(f"\nQuery: {query}")
        for doc in bm25.invoke(query):
            print(f"  {doc.metadata['doc_id']}: {doc.page_content[:80]!r}")


if __name__ == "__main__":
    main()

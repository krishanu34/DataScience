import os

from langchain_community.vectorstores import FAISS

import step00_models
import step01_loader
import step02_chunking

INDEX_DIR = "store/faiss"


def build_vectorstore(chunks, embeddings):
    return FAISS.from_documents(chunks, embeddings)


def save_vectorstore(vectorstore, path=INDEX_DIR):
    vectorstore.save_local(path)


def load_vectorstore(embeddings, path=INDEX_DIR):
    # The docstore is saved with pickle, which is only safe to load because we created the file ourselves.
    return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)


def main():
    embeddings = step00_models.get_embeddings()

    if not os.path.exists(INDEX_DIR):
        documents = step01_loader.load_documents()
        chunks = step02_chunking.chunk_documents(documents)
        print(f"Embedding {len(chunks)} chunks...")
        vectorstore = build_vectorstore(chunks, embeddings)
        save_vectorstore(vectorstore)
        print(f"Saved the index to {INDEX_DIR}")

    vectorstore = load_vectorstore(embeddings)
    print(f"Loaded an index with {vectorstore.index.ntotal} vectors")

    query = "How do I move rarely used blobs to a cheaper storage tier?"
    for doc, score in vectorstore.similarity_search_with_score(query, k=3):
        print(f"\nscore={score:.3f}  {doc.metadata['doc_id']}")
        print(doc.page_content[:200])


if __name__ == "__main__":
    main()

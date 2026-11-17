import os

import step00_models
import step01_loader
import step02_chunking
import step03_vectorstore
import step04_bm25
import step05_ensemble
import step06_reranker

QUERY = "Why do I still get AuthorizationPermissionMismatch after assigning the right role?"

RETRIEVE_K = 50  # chunks fetched from BM25 and from FAISS, each
RERANK_POOL = 30  # best merged chunks that Gemini reads and scores
FINAL_TOP_N = 5  # chunks kept for the answer


def show(title, docs, shown=5):
    print(f"\n{title}  [{len(docs)} chunks, showing the top {min(shown, len(docs))}]")
    for position, doc in enumerate(docs[:shown], start=1):
        score = doc.metadata.get("rerank_score")
        score_text = f"  score={score}" if score is not None else ""
        print(f"  {position}. {doc.metadata['doc_id']}{score_text}")
        print(f"     {doc.page_content[:90]!r}")


def main():
    print(f"Query: {QUERY}")

    # Step 1: load the markdown files with their metadata.
    documents = step01_loader.load_documents()
    print(f"\nStep 1: loaded {len(documents)} documents")

    # Step 2: split the documents into chunks.
    chunks = step02_chunking.chunk_documents(documents)
    print(f"Step 2: created {len(chunks)} chunks")

    # Step 3: FAISS vector store. It is embedded and saved once, then loaded from disk.
    embeddings = step00_models.get_embeddings()
    if not os.path.exists(step03_vectorstore.INDEX_DIR):
        vectorstore = step03_vectorstore.build_vectorstore(chunks, embeddings)
        step03_vectorstore.save_vectorstore(vectorstore)
    vectorstore = step03_vectorstore.load_vectorstore(embeddings)
    vector = vectorstore.as_retriever(search_kwargs={"k": RETRIEVE_K})
    print(f"Step 3: vector store has {vectorstore.index.ntotal} vectors")

    # Step 4: BM25 keyword index.
    if not os.path.exists(step04_bm25.CHUNKS_FILE):
        step04_bm25.save_chunks(chunks)
    bm25 = step04_bm25.build_bm25(chunks, k=RETRIEVE_K)
    print("Step 4: BM25 index built")

    show("Step 4 result - BM25 (keyword match):", bm25.invoke(QUERY))
    show("Step 3 result - FAISS (meaning match):", vector.invoke(QUERY))

    # Step 5: merge the two rankings.
    ensemble = step05_ensemble.build_ensemble(bm25, vector, weights=(0.5, 0.5), c=60)
    merged = ensemble.invoke(QUERY)
    show("Step 5 result - ensemble (BM25 + FAISS merged):", merged)

    # Step 6: let Gemini score the best merged chunks and keep the top few.
    llm = step00_models.get_llm()
    reranked = step06_reranker.rerank(QUERY, merged[:RERANK_POOL], llm, top_n=FINAL_TOP_N)
    show(f"Step 6 result - top {FINAL_TOP_N} after Gemini reranked {RERANK_POOL} chunks:", reranked)


if __name__ == "__main__":
    main()

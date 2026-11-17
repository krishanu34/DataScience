from langchain_classic.retrievers import EnsembleRetriever

import step00_models
import step03_vectorstore
import step04_bm25

# Each setting is (name, [bm25 weight, semantic weight], c). Change these to tune the fusion.
SETTINGS = [
    ("equal weights", [0.5, 0.5], 60),
    ("favour BM25", [0.8, 0.2], 60),
    ("favour semantic", [0.2, 0.8], 60),
    ("small c: top ranks count more", [0.5, 0.5], 5),
]


def build_retrievers(k=10):
    # k is how many results each retriever hands to the fusion.
    bm25 = step04_bm25.build_bm25(step04_bm25.load_chunks(), k=k)

    embeddings = step00_models.get_embeddings()
    vectorstore = step03_vectorstore.load_vectorstore(embeddings)
    vector = vectorstore.as_retriever(search_kwargs={"k": k})
    return bm25, vector


def build_ensemble(bm25, vector, weights=(0.5, 0.5), c=60):
    # Each retriever gives a chunk the score weight / (c + rank), and the scores are added up.
    return EnsembleRetriever(retrievers=[bm25, vector], weights=list(weights), c=c, id_key="chunk_id")


def rank_of(doc, results):
    for position, result in enumerate(results, start=1):
        if result.metadata["chunk_id"] == doc.metadata["chunk_id"]:
            return position
    return None  # the retriever did not return this chunk


def show_results(query, bm25, vector, weights, c, top=5):
    bm25_results = bm25.invoke(query)
    vector_results = vector.invoke(query)
    ensemble = build_ensemble(bm25, vector, weights, c)

    for position, doc in enumerate(ensemble.invoke(query)[:top], start=1):
        bm25_rank = rank_of(doc, bm25_results)
        vector_rank = rank_of(doc, vector_results)
        score = sum(
            weight / (c + rank)
            for weight, rank in zip(weights, [bm25_rank, vector_rank])
            if rank is not None
        )
        print(f"  {position}. {doc.metadata['doc_id']}  (bm25 rank={bm25_rank}, semantic rank={vector_rank}, score={score:.4f})")


def main():
    bm25, vector = build_retrievers(k=10)

    queries = [
        "INC-48213",  # exact identifier: BM25 finds it
        "how can I make storage cheaper by moving rarely used data to a lower cost option",  # paraphrase: vectors find it
        "AuthorizationPermissionMismatch error when uploading to blob storage",  # both help
    ]
    for query in queries:
        print(f"\nQuery: {query}")
        for name, weights, c in SETTINGS:
            print(f"\n {name}  (weights={weights}, c={c})")
            show_results(query, bm25, vector, weights, c)


if __name__ == "__main__":
    main()

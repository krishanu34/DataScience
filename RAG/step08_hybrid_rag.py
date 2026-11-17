import sys

from langchain_core.output_parsers import StrOutputParser

import step00_models
import step03_vectorstore
import step04_bm25
import step05_ensemble
import step06_reranker
import step07_simple_rag

RETRIEVE_K = 50  # chunks fetched from BM25 and from FAISS, each
RERANK_POOL = 30  # best merged chunks that Gemini reads and scores
FINAL_TOP_N = 5  # chunks given to the answer step


def build_ensemble_for_role(vectorstore, chunks, role):
    # BM25 cannot filter, so it is built only from the chunks this role may read.
    allowed = step07_simple_rag.ROLE_ACCESS[role]
    allowed_chunks = [chunk for chunk in chunks if chunk.metadata["acl"] in allowed]
    bm25 = step04_bm25.build_bm25(allowed_chunks, k=RETRIEVE_K)
    vector = step07_simple_rag.get_retriever(vectorstore, role, k=RETRIEVE_K)
    return step05_ensemble.build_ensemble(bm25, vector)


def retrieve(question, ensemble, llm):
    merged = ensemble.invoke(question)[:RERANK_POOL]
    return step06_reranker.rerank(question, merged, llm, top_n=FINAL_TOP_N)


def answer_question(question, ensemble, llm):
    docs = retrieve(question, ensemble, llm)

    # If even the best chunk scores low, refuse without asking the model to write an answer.
    best_score = docs[0].metadata.get("rerank_score") if docs else None
    if not docs or (best_score is not None and best_score < step06_reranker.MIN_RELEVANCE):
        return step07_simple_rag.NOT_FOUND, []

    chain = step07_simple_rag.PROMPT | llm | StrOutputParser()
    evidence = step07_simple_rag.format_evidence(docs)
    answer = chain.invoke({"question": question, "evidence": evidence})
    return answer, step07_simple_rag.cited_sources(answer, docs)


def best_score(question, role, ensembles, vectorstore, chunks, llm):
    if role not in ensembles:
        ensembles[role] = build_ensemble_for_role(vectorstore, chunks, role)
    docs = retrieve(question, ensembles[role], llm)
    return docs[0].metadata.get("rerank_score") if docs else 0


def score_report(vectorstore, chunks, llm):
    # Shows how far apart the best rerank scores are for questions with and without an answer.
    ensembles = {}
    answerable = [(q, "employee") for q, _ in step06_reranker.QUESTIONS]
    groups = [("ANSWERABLE", answerable), ("NOT ANSWERABLE", step06_reranker.UNANSWERABLE)]

    scores = {}
    for name, questions in groups:
        print(f"\n{name}: best rerank score per question")
        scores[name] = []
        for question, role in questions:
            score = best_score(question, role, ensembles, vectorstore, chunks, llm)
            scores[name].append(score)
            print(f"  {score:>4}  ({role}) {question[:80]}")

    lowest_answerable = min(scores["ANSWERABLE"])
    highest_unanswerable = max(scores["NOT ANSWERABLE"])
    print(f"\nLowest score of an answerable question:      {lowest_answerable}")
    print(f"Highest score of an unanswerable question:   {highest_unanswerable}")
    print(f"Current threshold (MIN_RELEVANCE):           {step06_reranker.MIN_RELEVANCE}")


def main():
    vectorstore = step03_vectorstore.load_vectorstore(step00_models.get_embeddings())
    chunks = step04_bm25.load_chunks()
    llm = step00_models.get_llm()

    if "--report" in sys.argv:
        score_report(vectorstore, chunks, llm)
        return

    questions = [
        ("What caused incident INC-48213 and how was it resolved?", "employee"),
        ("Why do I still get AuthorizationPermissionMismatch after assigning the right role?", "employee"),
        ("How many days after last modification are blobs deleted under the current lifecycle policy?", "employee"),
        ("What is our company's parental leave policy?", "employee"),  # not in the knowledge base
        ("What is the break-glass procedure for kv-contoso-prod-001 and who approves it?", "guest"),  # restricted
        ("What is the break-glass procedure for kv-contoso-prod-001 and who approves it?", "security_admin"),
    ]

    ensembles = {}  # one search per role, built the first time the role is used
    for question, role in questions:
        if role not in ensembles:
            ensembles[role] = build_ensemble_for_role(vectorstore, chunks, role)

        answer, sources = answer_question(question, ensembles[role], llm)

        print(f"\nQuestion ({role}): {question}")
        print(f"Answer: {answer}")
        print("Sources:" if sources else "Sources: none")
        for number, doc in sources:
            score = doc.metadata.get("rerank_score")
            print(f"  [{number}] {doc.metadata['doc_id']} ({doc.metadata['acl']})  rerank score={score}")


if __name__ == "__main__":
    main()

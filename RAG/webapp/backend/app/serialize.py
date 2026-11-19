def chunk_json(doc, **extra):
    meta = doc.metadata
    return {
        "chunk_id": meta["chunk_id"],
        "doc_id": meta["doc_id"],
        "url": meta["url"],
        "product": meta["product"],
        "acl": meta["acl"],
        "text": doc.page_content,
        "rerank_score": meta.get("rerank_score"),
        **extra,
    }


def text_of(message):
    return str(getattr(message, "text", ""))

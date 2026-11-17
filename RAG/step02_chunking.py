from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

import step01_loader


def merge_small_chunks(chunks, min_chars):
    # Chunks come in document order, so a small chunk is joined to the chunk next to it from the same document.
    merged = []
    for chunk in chunks:
        previous = merged[-1] if merged else None
        same_document = previous is not None and previous.metadata["doc_id"] == chunk.metadata["doc_id"]
        either_is_small = same_document and (
            len(previous.page_content) < min_chars or len(chunk.page_content) < min_chars
        )
        if either_is_small:
            previous.page_content += "\n\n" + chunk.page_content
        else:
            merged.append(chunk)
    return merged


def add_chunk_ids(chunks):
    # "doc_id#position" is unique and is the same on every run.
    counts = {}
    for chunk in chunks:
        doc_id = chunk.metadata["doc_id"]
        counts[doc_id] = counts.get(doc_id, 0) + 1
        chunk.metadata["chunk_id"] = f"{doc_id}#{counts[doc_id]}"
    return chunks


def chunk_documents(documents, chunk_size=1200, chunk_overlap=150, min_chars=200):
    splitter = RecursiveCharacterTextSplitter.from_language(
        Language.MARKDOWN,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(documents)
    return add_chunk_ids(merge_small_chunks(chunks, min_chars))


def main():
    documents = step01_loader.load_documents()
    chunks = chunk_documents(documents)

    print(f"{len(documents)} documents -> {len(chunks)} chunks")
    print(f"Shortest chunk: {min(len(c.page_content) for c in chunks)} characters")
    print(chunks[5].metadata)
    print(chunks[5].page_content)


if __name__ == "__main__":
    main()

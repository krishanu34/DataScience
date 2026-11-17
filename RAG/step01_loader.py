import json
from pathlib import Path

from langchain_community.document_loaders import DirectoryLoader, TextLoader


def load_manifest(path="data/raw"):
    with open(Path(path) / "dataset_manifest.json", encoding="utf-8") as f:
        entries = json.load(f)["documents"]
    return {entry["path"]: entry for entry in entries}


def load_documents(path="data/raw"):
    loader = DirectoryLoader(
        path,
        glob="**/*.md",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    )
    documents = loader.load()

    manifest = load_manifest(path)
    for doc in documents:
        file_path = Path(doc.metadata["source"]).relative_to(path).as_posix()
        entry = manifest[file_path]
        doc.metadata["doc_id"] = entry["doc_id"]
        doc.metadata["url"] = entry["url"]
        doc.metadata["product"] = entry["product"]
        doc.metadata["acl"] = entry["acl"]
    return documents


def main():
    documents = load_documents()
    print(f"Loaded {len(documents)} documents")
    print(documents[0].metadata)
    print(documents[0].page_content[:300])


if __name__ == "__main__":
    main()

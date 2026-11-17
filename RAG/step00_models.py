import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ["GOOGLE_CLOUD_LOCATION"]
LLM_MODEL = os.environ["LLM_MODEL"]
EMBEDDING_MODEL = os.environ["EMBEDDING_MODEL"]


def get_llm():
    # vertexai=True sends the calls to Vertex AI, using the credentials from `gcloud auth application-default login`.
    return ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        vertexai=True,
        project=PROJECT,
        location=LOCATION,
        temperature=0,
    )


def get_embeddings():
    return GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        vertexai=True,
        project=PROJECT,
        location=LOCATION,
    )


def main():
    print(f"LLM: {LLM_MODEL}")
    print(f"Embeddings: {EMBEDDING_MODEL}")
    print("LLM replied:", get_llm().invoke("Reply with OK").text)
    print("Embedding size:", len(get_embeddings().embed_query("hello")))


if __name__ == "__main__":
    main()

# RAG Learning Project

A step-by-step build of a Retrieval-Augmented Generation (RAG) system over a small knowledge base (Azure docs plus a few synthetic internal documents). Each `stepNN_*.py` file adds one idea on top of the previous one, from loading files to an agentic RAG with LangGraph.

## 1. Prerequisites

- Python 3.10 or newer
- Google Cloud CLI (`gcloud`)
- Access to a Google Cloud project with Vertex AI enabled (the LLM and embeddings run on Vertex AI)

## 2. Set up the environment

Run these commands from the `RAG` folder (the folder that contains this README). The scripts use relative paths such as `data/raw` and `store/`, so they must be run from here.

```powershell
# Windows PowerShell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# macOS / Linux
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Configure Google Cloud

1. Sign in so the code can call Vertex AI (no API key is needed):

   ```
   gcloud auth application-default login
   ```

2. Create a `.env` file in this folder. Use your own project ID:

   ```
   GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
   GOOGLE_CLOUD_LOCATION=global
   LLM_MODEL=gemini-3.5-flash
   EMBEDDING_MODEL=gemini-embedding-001
   ```

   `step00_models.py` reads these four values. Change the model names if your project uses different ones.

## 4. Check the setup

```
python step00_models.py
```

Expected: the model names, `LLM replied: OK`, and an embedding size. If this fails, fix it before going further (usually a missing `.env` value or a missing `gcloud` login).

## 5. How to read the files

Read and run the files in order. Every file has a `main()` that demonstrates only that step, so you can run it on its own:

```
python step01_loader.py
```

Open the file first, read it top to bottom, then run it and compare the output with the code. Later steps import earlier ones, so a function you do not recognise is usually defined in an earlier step.

| Step | File | What it teaches | Needs Vertex AI |
|---|---|---|---|
| 0 | `step00_models.py` | Create the Gemini chat model and the embedding model | Yes |
| 1 | `step01_loader.py` | Load the markdown files and attach metadata (doc id, URL, product, access level) from `data/raw/dataset_manifest.json` | No |
| 2 | `step02_chunking.py` | Split documents into chunks, merge tiny chunks, give each chunk a stable `chunk_id` | No |
| 3 | `step03_vectorstore.py` | Embed chunks and store them in a FAISS vector index (semantic search) | Yes |
| 4 | `step04_bm25.py` | BM25 keyword search with a tokenizer that keeps identifiers such as `INC-48213` whole | No |
| 5 | `step05_ensemble.py` | Combine BM25 and vector results with Reciprocal Rank Fusion; try different weights and `c` | Yes |
| 6 | `step06_reranker.py` | Have Gemini score the merged candidates and keep the best; measure the gain | Yes |
| 7 | `step07_simple_rag.py` | Baseline RAG: vector search, role-based access filter, answer with `[1]` citations, refuse when nothing is found | Yes |
| 8 | `step08_hybrid_rag.py` | Hybrid retrieval + reranker + a relevance threshold that refuses weak answers | Yes |
| 9 | `step09_agentic_rag.py` | A tool-calling agent that chooses between keyword, semantic and hybrid search and rewords queries | Yes |
| 10 | `step10_langgraph_rag.py` | The same idea as an explicit LangGraph workflow: plan sub-questions, research each, then answer | Yes |
| - | `test.py` | Runs one query through steps 1 to 6 and prints the result of each stage | Yes |

### Suggested path

1. Steps 1 and 2 show how raw files become chunks.
2. Steps 3 and 4 show the two ways to search (meaning and keywords). Run both and compare the results for `INC-48213` and for a paraphrased question.
3. Steps 5 and 6 show how to merge and rerank them. Change `SETTINGS` in `step05_ensemble.py` and watch the ranks change.
4. Step 7 is the simplest complete RAG. Steps 8, 9 and 10 improve it one idea at a time. Run the same question through each and compare the answers.
5. `test.py` is a good recap: it shows the output of every retrieval stage for one query.

### Useful options

- `python step06_reranker.py` compares ranking before and after reranking over 10 questions.
- `python step08_hybrid_rag.py --report` prints the rerank scores for answerable and unanswerable questions. This is how `MIN_RELEVANCE` was chosen.

## 6. Folders

| Path | Content |
|---|---|
| `data/raw/azure_docs/` | Azure documentation subset (markdown) |
| `data/raw/synthetic/` | Made-up internal documents used for tests (runbook, policies, break-glass procedure, ...) |
| `data/raw/dataset_manifest.json` | One entry per document: id, URL, product, access level (`public`, `internal`, `restricted`) |
| `store/faiss/` | Saved vector index (created by step 3) |
| `store/bm25/chunks.json` | Saved chunks for the BM25 index (created by step 4) |
| `docs/` | Background: `agentic_rag_pov_plan.md` is the original design plan, `roadmap.md` covers fine-tuning ideas |

## 7. Things to know

- **Rebuilding the index.** The `store/` folder is included, so steps 3 and later reuse it. To rebuild (this calls the embedding API for every chunk), delete `store/` and run step 3 and step 4 again.
- **Access control.** Roles are `guest`, `employee` and `security_admin`. A role only retrieves chunks whose access level it may read, so restricted documents never reach the model for lower roles.
- **Prompt injection.** One synthetic document contains a hidden instruction. Steps 9 and 10 check that the answer does not follow it.
- **Cost.** Steps 5 to 10 call Gemini and the embedding model on every question. Steps 6, 8, 9 and 10 make several calls per question.
- **Saved index loading.** `step03_vectorstore.py` loads the FAISS index with pickle deserialization. Only load an index you built yourself.
- **Docs are partly out of date.** `docs/agentic_rag_pov_plan.md` describes an earlier notebook-based design. The `step*.py` files are the current code.

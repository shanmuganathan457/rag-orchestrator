# RAG Orchestrator

A modern, production-ready **Retrieval-Augmented Generation (RAG)** and **GraphRAG** orchestration platform built entirely on free and open-source foundations. It features hybrid search (vector embeddings + keyword BM25), knowledge graph integration, runtime model switching, real-time citation tracking, evaluation benchmarking, and an interactive data visualization studio.

---

## 🌟 Application Walkthrough & Architecture Screens

Below is a detailed walkthrough of each major screen and core system capability.

---

### 1. Interactive Chat & Contextual Retrieval with Citations

![Chat Interface](assets/chat_screen.jfif)

#### What It Shows:
- **Full-Width Streaming Chat Interface:** Clean, focused conversational experience designed for low-latency streaming answers from connected LLMs.
- **Precision Page-Level Citations:** Every assertion in the response is tagged with interactive superscript badges (e.g. `[1]`, `[2]`, `[3]`). Clicking any citation opens the exact passage, document name, page number, and vector relevance score.
- **RAG Mode Indicator:** Displays real-time status whether queries run through standard **Vector RAG** (PostgreSQL + pgvector) or enhanced **GraphRAG** (hybrid vector + Neo4j entity graph).
- **Dual-Pane Collapsible Sidebar:**
  - **Documents Tab:** Lists all indexed files (`.pdf`, `.txt`, `.docx`, `.csv`, `.md`), page counts, chunk counts, and fine-grained checkboxes to restrict retrieval to specific documents.
  - **Chats Tab:** Stores full chat histories in persistent storage with automated title generation from your initial prompts, quick switching between sessions, and deletion controls.
  - **ChatGPT-Style Global Header:** Features quick search across files and conversations, collapsible slide-out controls, and upload dropzones.

#### How It Works:
1. User submits a query via the floating input field.
2. The orchestrator embeds the query using **FastEmbed (`bge-small-en-v1.5`)** and runs Reciprocal Rank Fusion (RRF) between cosine vector similarity and PostgreSQL full-text search.
3. If **GraphRAG** is enabled, it concurrently traverses the **Neo4j** entity graph to retrieve 2-hop connected entities and relationships related to the query.
4. Top passages and graph context are synthesized and streamed directly to the frontend using **Server-Sent Events (SSE)**.

---

### 2. Retrieval Evaluation & Benchmarking Studio

![Retrieval Evaluation](assets/evaluation_screen.jfif)

#### What It Shows:
- **Automated Synthetic Question Benchmarking:** Generates test questions directly from your uploaded documents to stress-test your knowledge base without manual query authoring.
- **Comparative Search Strategy Metrics:**
  - **Vector Search (pgvector):** Evaluates pure semantic similarity using dense embeddings.
  - **Keyword Search (BM25 / Full-Text):** Evaluates exact lexical matching on Postgres full-text indices.
  - **Hybrid Search (Reciprocal Rank Fusion - RRF):** Evaluates rank fusion combining both lexical and semantic methods.
- **Key Metrics Tracked:**
  - **Hit@1 & Hit@5:** Percentage of times the true ground-truth source chunk appeared in the top 1 or top 5 retrieved results.
  - **Mean Reciprocal Rank (MRR):** Industry-standard evaluation score assessing ranked retrieval quality.
  - **Average Latency (ms):** Detailed response times per retrieval pipeline.
- **Per-Question Diagnostic Matrix:** Tabular breakdown showing rank placements (`#1`, `#2`, `-`) for every generated question across all three search modalities.

#### How It Works:
1. The backend samples random chunks across your active document corpus.
2. The configured LLM synthesizes natural questions that can be answered specifically by each sampled chunk.
3. Each retrieval engine independently ranks candidates. The benchmark calculates hit rates, MRR, and latency, presenting actionable performance insights before production deployment.

---

### 3. Integrated Data Studio & Visualization Workbench

![Data Studio](assets/data_studio_screen.jfif)

#### What It Shows:
- **Full-Frame Analytical Workspace:** Replaces the chat canvas with an end-to-end analytical data studio when activated from the top navigation bar.
- **Smart Filtered Document Browser:** The left sidebar automatically detects Data Studio mode and filters your library to show only structured data files (`.csv`, `.json`, `.xlsx`, `.tsv`).
- **Multi-Sheet Canvas & Notes:** Allows analysts to maintain multiple workbooks, document critical assumptions, inspect tabular records, and export reports directly to PDF and PNG.
- **Seamless State Preservation:** Seamlessly toggle between Chat, Evaluation, and Data Studio without losing active queries, conversation threads, or unsaved notes.

#### How It Works:
1. Structured tabular datasets are parsed directly in the browser environment.
2. Users can create visualizations, review data distributions, and prepare structured references that complement unstructured document retrieval.

---

### 4. Dynamic LLM Provider & GraphRAG Configuration

![Settings Modal](assets/settings_popup.jfif)

#### What It Shows:
- **Multi-Provider Switcher:** Seamlessly switch between local open-weight inference models and remote providers on the fly without restarting the container stack.
- **Supported Providers:**
  - **Ollama:** Completely local and private execution (`llama3`, `mistral`, `deepseek-r1`, `qwen2.5`, etc.).
  - **Groq:** Ultra-fast cloud inference for open-weights (`llama-3.3-70b-versatile`, `gpt-oss-120b`).
  - **OpenAI Compatible Endpoints:** Any custom endpoint matching standard chat completion APIs.
- **GraphRAG Toggle:** Instant runtime toggle enabling or disabling entity graph ingestion and Neo4j traversal.
- **Live Connection Diagnostics:** Shows active model IDs, provider status, and connection health indicators in real time.

#### How It Works:
- Dynamic provider factory pattern in the FastAPI backend swaps client instances and validation schemas in memory when updated via `/api/v1/providers/switch`.

---

## 🛠️ Complete Technology Stack

| Layer | Technology | Details & Purpose |
|---|---|---|
| **Frontend Framework** | **Next.js 14 (App Router)** | Server & Client Components, React 18, dynamic route optimization. |
| **Styling & Icons** | **Tailwind CSS + Lucide Icons** | Custom dark mode palette (`ink-*`, `accent`), responsive flex/grid layouts. |
| **Backend Framework** | **FastAPI (Python 3.12)** | Asynchronous REST endpoints, streaming responses via Server-Sent Events (SSE). |
| **Embeddings & NLP** | **FastEmbed + spaCy** | Local `bge-small-en-v1.5` embeddings (384-dim) and `en_core_web_sm` NER for entity extraction. |
| **Vector Database** | **PostgreSQL 16 + pgvector** | Hybrid indexing: HNSW / IVFFlat vector indexing combined with `tsvector` GIN keyword search. |
| **Graph Database** | **Neo4j 5 Community Edition** | Knowledge Graph storage: `(:Chunk)-[:MENTIONS]->(:Entity)` relationships queried via Cypher. |
| **Inference Engines** | **Ollama / Groq / OpenAI-compatible** | Free and local model execution without mandatory cloud dependencies. |
| **Containerization** | **Docker & Docker Compose** | Multi-container automated orchestration for DB, Neo4j, Backend, and Frontend. |

---

## 🚀 Quickstart & Deployment

### 1. Clone the Repository
```bash
git clone https://github.com/shanmuganathan457/rag-orchestrator.git
cd rag-orchestrator
git checkout feat/v1.1-multi-format-citations
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Ensure your database credentials, Neo4j password, and optional Groq/OpenAI keys are populated.

### 3. Launch with Docker Compose
```bash
docker compose up -d --build
```

### 4. Access the Application
- **Frontend UI:** [http://localhost:3000](http://localhost:3000)
- **Backend Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Graph Browser:** [http://localhost:7474](http://localhost:7474)

---

## 📄 License
Open-source under the MIT License.

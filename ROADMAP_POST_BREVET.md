# Technical Roadmap ETHER — Post-Brevet (v1.2)

This document outlines the technical strategy for implementing Persistent Memory and Enhanced Model Routing after the "Brevet" priority period.

## 1. Persistent Memory with SQLite & Transformers.js

### Objective
Replace the current `localStorage`-based and flat-file memory system with a robust vector search system for long-term agent learning and conversation context retrieval.

### Architecture
- **Database:** SQLite via `better-sqlite3` (or `sqlite3` for process-level integration).
- **Path:** `~/.ether/memory.db`.
- **Embeddings:** `Transformers.js` (running in the renderer or a dedicated worker).
- **Search:** Hybrid (Cosine Similarity on vectors + Keyword search on metadata).

### Implementation Steps
1. **Main Process (`main.js`):**
   - Integrate `better-sqlite3`.
   - Define schema:
     ```sql
     CREATE TABLE IF NOT EXISTS memory (
       id TEXT PRIMARY KEY,
       content TEXT NOT NULL,
       embedding BLOB, -- Vector data
       metadata TEXT, -- JSON tags, context
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     ```
   - Create IPC handlers: `memory-save`, `memory-search`, `memory-delete`.

2. **Renderer Process (`renderer/memory.js`):**
   - Integrate `@xenova/transformers` (Transformers.js).
   - Implement `generateEmbedding(text)` using a lightweight model (e.g., `all-MiniLM-L6-v2`).
   - Update `MEMORY.addFact` and `RAG.addDocument` to utilize the SQLite backend.

3. **User Interface:**
   - Add a "Memory Manager" view to visualize and prune stored facts.

---

## 2. Model Routing with Fallback Chain

### Objective
Improve reliability and transparency by implementing a configurable fallback mechanism when primary providers (Groq, Gemini, Mistral) fail or timeout.

### Configuration (`renderer/engine.js`)
```javascript
const FALLBACK_CONFIG = {
  timeout: 10000,      // 10s per request
  retries: 1,         // 1 retry before fallback
  switchThreshold: 3, // 3 consecutive failures to mark provider as "Down"
};

const PROVIDER_CHAIN = [
  { provider: 'mistral', priority: 1 },
  { provider: 'gemini', priority: 2 },
  { provider: 'groq', priority: 3 },
  { provider: 'cerebras', priority: 4 }
];
```

### Implementation Steps
1. **Logic Enhancement (`renderer/engine.js`):**
   - Refactor `_streamMulti` and `getSmartRoute` to track consecutive failures per provider.
   - Implement `Promise.race` with a timeout for each provider call.
   - Show a UI badge (e.g., "Using Gemini (Mistral timeout)") when a fallback occurs.

2. **IPC Updates (`main.js`):**
   - Add `test-provider` endpoint to allow the renderer to check a specific provider's health without a full `test-all-providers` call.

3. **UI Updates:**
   - Real-time status indicators in the settings panel and chat interface.

---

## 3. Constraints & Compatibility
- **No TypeScript:** Keep code in Vanilla JS to match existing architecture.
- **Paths:** Always use `app.getPath('userData')` or `os.homedir()` for storage.
- **Offline-First:** Transformers.js models should be cached locally after the first download (~50MB).

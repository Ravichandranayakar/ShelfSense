# ShelfSense

> **AI-Powered Intent Commerce Platform & Autonomous Merchant Demand Radar**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite_5-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_+_SQLite_WAL-336791.svg?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Gemini](https://img.shields.io/badge/AI_Engine-Google_Gemini_Flash--Lite-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev)
[![Gnani.ai](https://img.shields.io/badge/Voice_AI-Gnani_Prisma_v3.0_+_Timbre_v3.0-FF6F00.svg)](https://gnani.ai)
[![Render](https://img.shields.io/badge/Deployment-Render_Blueprint_Ready-46E3B7.svg?logo=render&logoColor=white)](https://render.com)

---

## Executive Summary

Traditional e-commerce search relies on rigid keyword tokenization and static category hierarchies. When shoppers describe functional requirements, environmental contexts, or compound budget parameters (e.g. *"lightweight waterproof commuter bag for campus under ₹2,500 with no loud logos"*), conventional search engines return zero results. The shopper bounces, and the merchant remains unaware of the lost revenue opportunity.

**ShelfSense** resolves this disconnect with a closed-loop intelligence architecture:
1. **Multimodal Intent Engine:** Decodes conversational English and Indic voice queries into parametric constraints, displaying live interactive chips and matching against catalog attributes.
2. **Autonomous Demand Interception:** Automatically logs zero-result searches and explicit commissioning requests as structured telemetry in `demand_signals`.
3. **Merchant Demand Radar:** Aggregates unmet demand into actionable market clusters, quantifies lost Gross Merchandise Value (GMV), and streams real-time customer query feeds.
4. **Instant Catalog Fulfillment:** Enables merchants to convert unmet demand clusters into active, provisioned inventory (`POST /api/admin/demand/fulfill`) with one click, automatically updating live catalog stock (+15 units).
5. **Scientific Reorder Point (ROP) Inventory:** Dynamically computes replenishment triggers using 7-day trailing velocity and supplier lead times, supported by a transactional outbox background worker.

---

## System Architecture

```
                                 [ BROWSER CLIENT ]
                     React 18 + Vite 5 + Tailwind CSS + Shadcn
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
      [ Voice Hardware Layer ]                       [ Natural Intent Bar ]
  Web Audio API (16kHz PCM Stream)              Interactive Constraint Chips & Search
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
          POST /api/voice/stt     POST /api/ai/shop       GET /api/products
                 │                       │                       │
═════════════════╪═══════════════════════╪═══════════════════════╪═════════════════
                 ▼                       ▼                       ▼
                                [ APPLICATION LAYER ]
                              FastAPI (Python 3.12)
                 │                       │                       │
                 ├─ Gnani Prisma STT     ├─ Gemini Flash-Lite    ├─ SQL Search Engine
                 ├─ Gnani Timbre TTS     ├─ Deterministic Regex  ├─ ACID Inventory Lock
                 │  (Indic + English)    │  (High-Availability)  │  (BEGIN IMMEDIATE)
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         ▼
                             [ TRANSACTIONAL OUTBOX ]
                         Async Background Worker (500ms)
                                         │
                                         ▼
                            [ PERSISTENCE LAYER ]
              Dual-Engine: Managed PostgreSQL ↔ SQLite (WAL Mode)
        ┌─────────────────────────────────────────────────────────────┐
        │  • products          (SKU, price_paise, stock, attributes)  │
        │  • orders            (idempotency_key, total_paise, status) │
        │  • order_items       (order_id, product_id, quantity)       │
        │  • outbox            (event_type, payload, processed_at)    │
        │  • alerts            (type, evidence_json, draft_text)      │
        │  • demand_signals    (query, category, budget, source)      │
        └─────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                           [ MERCHANT DEMAND RADAR ]
        Aggregated Market Clusters ──> Sourcing RFQ Drafts ──> Live Catalog Fulfillment
```

---

## Core Capabilities

### 1. Multilingual Voice Commerce (Prisma v3.0 & Timbre v3.0)
- **Dual-Engine Hybrid Audio Architecture:**
  - **Engine A (Browser Speech API):** Streams interim words instantly to the search box with zero latency.
  - **Engine B (Gnani Cloud AI STT):** Real-time hardware fallback via `AudioContext` 16kHz mono PCM encoding. If the browser speech recognition returns empty (e.g. corporate firewalls, Windows mic restrictions), the backend automatically transcribes the audio via Gnani Prisma v3.0.
- **Microphone Diagnostic Telemetry:** Monitors hardware input volume and alerts the user if microphone input is silent (0% signal) due to OS-level privacy locks.
- **Multilingual Support:** Supports Indian English (`en-IN`), Kannada (`kn-IN`), Hindi (`hi-IN`), Tamil (`ta-IN`), Telugu (`te-IN`), and additional Indic languages.
- **Spoken Recommendations:** Synthesizes natural audio responses via Gnani Timbre v3.0 (`/api/voice/tts`).

### 2. Natural Language Intent Commerce
- Translates unstructured natural language into structured database parameters:
  $$\text{Query: "monsoon laptop bag under ₹2,500"} \longrightarrow \begin{cases} \text{category:} & \text{"bags"} \\ \text{max\_price\_paise:} & 250000 \\ \text{attributes:} & \{\text{"water\_resistant": true}\} \end{cases}$$
- **Primary AI Engine:** Google Gemini Flash-Lite (`gemini-flash-lite-latest`) with function calling.
- **Zero-Downtime Fallback:** Built-in deterministic regex and keyword tokenizer (`local_intent`) guarantees search availability even during network drops or API rate limiting.
- **Interactive Intent Chips:** Shoppers can inspect and toggle individual extracted constraints in real-time.

### 3. Autonomous Demand Capture & Commissioning
- Every zero-match query is silently recorded in the `demand_signals` table with category and budget metadata.
- Shoppers encountering a catalog gap can submit custom sourcing tickets specifying materials, dimensions, and target budget.

### 4. Merchant Demand Radar & Real-Time Fulfillment Loop
- **Telemetry Aggregation:** Groups unstructured customer requests into prioritized opportunity clusters with estimated lost GMV.
- **Live Customer Query Feed:** The demand breakdown drawer streams real customer search queries captured across the last 72 hours alongside verified benchmarks.
- **Closed-Loop Catalog Fulfillment:** Merchants can click **"Fulfill Request"** (`POST /api/admin/demand/fulfill`) to provision new inventory directly into the live store catalog (+15 units) and automatically resolve the unmet demand gap.

### 5. Scientific Reorder Point (ROP) Supply Chain Allocation
- Replaces static stock alerts with dynamic supply chain replenishment math:
  $$\text{ROP} = (D \times L) + SS$$
  Where:
  - $D$ = Daily Sales Velocity (7-day trailing average)
  - $L$ = Supplier Lead Time (days)
  - $SS$ = Safety Stock threshold
- Alerts trigger automatically via the transactional outbox loop when inventory dips below the calculated threshold.

### 6. Atomic ACID Checkout & Idempotency
- Row-level locking ensures atomic stock decrement without overselling race conditions under concurrent load.
- Unique idempotency keys (`idempotency_key`) prevent duplicate charges from browser refresh or network retries.
- Orders and outbox events are committed in the same database transaction.

---

## Technology Stack

| Layer | Component | Production Specification |
| :--- | :--- | :--- |
| **Frontend** | Framework | React 18, Vite 5.4, Tailwind CSS, Google Material Symbols |
| **API Client** | Networking | Centralized `services/api.js` with dynamic `VITE_API_URL` resolution |
| **Backend** | Application | FastAPI (Python 3.12), Uvicorn ASGI Server, Pydantic v2 |
| **Database** | Dual Persistence | PostgreSQL (Render Managed) with automatic SQLite (WAL mode) fallback |
| **Primary AI** | Intent Search | Google Gemini Flash-Lite (`gemini-flash-lite-latest`) |
| **Voice AI** | STT / TTS | Gnani.ai Prisma v3.0 (STT) + Timbre v3.0 (TTS) |
| **Containerization** | Docker | Multi-stage Node 20 + Nginx Alpine (Frontend) / Python 3.12-slim (Backend) |
| **Infrastructure** | Cloud Hosting | Render Infrastructure Blueprint (`render.yaml`) |

---

## Repository Structure

```
ShelfSense/
├── ShelfSense-store/
│   ├── backend/
│   │   ├── main.py              # FastAPI app, AI intent, voice STT/TTS, ROP worker, fulfillment
│   │   ├── requirements.txt     # Python production dependencies
│   │   ├── Dockerfile           # Python 3.12-slim Render container
│   │   └── store.db             # Local SQLite database (WAL mode, auto-generated)
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── SearchResultsView.jsx     # Intent search studio, chips, live results
│   │   │   │   └── MerchantDemandRadar.jsx   # Merchant intelligence console & drawer
│   │   │   ├── services/
│   │   │   │   └── api.js                    # Dynamic VITE_API_URL resolution client
│   │   │   ├── utils/
│   │   │   │   └── voiceTranscriber.js       # Dual-engine Web Speech + Gnani audio recorder
│   │   │   ├── App.jsx                       # Root application, store catalog, cart, wishlist
│   │   │   ├── main.jsx                      # Vite entry point
│   │   │   └── styles.css                    # Tailwind CSS configuration & fonts
│   │   ├── public/
│   │   │   └── products/                     # Studio-verified catalog product assets
│   │   ├── Dockerfile                        # Multi-stage Node 20 + Nginx Alpine container
│   │   ├── nginx.conf                        # Production Nginx SPA routing & caching
│   │   ├── package.json                      # Frontend dependencies
│   │   └── vite.config.js                    # Vite configuration & local dev proxy
│   ├── render.yaml                           # One-click Render Blueprint specification
│   └── .env.example                          # Documented environment variable template
├── scripts/
│   ├── smoke_stepfun.py                      # AI provider validation test
│   └── stress_test.py                        # Concurrent checkout race-condition validator
├── .gitignore                                # Strict exclusion of secrets, DBs, and temp files
└── README.md                                 # Technical platform documentation
```

---

## Local Development Quickstart

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** with `npm`

### 1. Backend Setup

```powershell
# Navigate to backend directory
cd ShelfSense-store/backend

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
# source .venv/bin/activate    # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API will be active at `http://localhost:8000`. OpenAPI interactive docs at `http://localhost:8000/docs`.*

### 2. Frontend Setup

```powershell
# Open a second terminal and navigate to frontend directory
cd ShelfSense-store/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Frontend will be live at `http://localhost:5173`.*

---

## Render Cloud Deployment

ShelfSense includes a production-ready **Render Blueprint** ([`render.yaml`](file:///C:/Users/Ravichandran/OneDrive/Desktop/ShelfSense/ShelfSense-store/render.yaml)) configured for zero-downtime deployment.

### Option A: One-Click Blueprint Deployment (Recommended)
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
3. Select your repository. Render will automatically parse `render.yaml` and provision:
   - **`shelfsense-backend`** (Python Web Service with health check `/api/health`)
   - **`shelfsense-storefront`** (Static Site with SPA rewrite rules)
   - **`shelfsense-db`** (Managed PostgreSQL database)
4. Set your **`GOOGLE_API_KEY`** in the prompt and click **Apply**.

### Option B: Manual UI Deployment

#### 1. Backend Web Service
- **Type:** Web Service
- **Root Directory:** `ShelfSense-store/backend`
- **Runtime:** Python 3
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/api/health`
- **Environment Variables:**
  - `GOOGLE_API_KEY`: *(Your Gemini API key)*
  - `DATABASE_URL`: *(Render PostgreSQL connection string)*

#### 2. Frontend Static Site
- **Type:** Static Site
- **Root Directory:** `ShelfSense-store/frontend`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Rewrite Rule:** `/*` → `/index.html`
- **Environment Variables:**
  - `VITE_API_URL`: `https://<your-backend-service>.onrender.com`

---

## API Reference

### Storefront & Catalog
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Returns filtered products by keyword, category, price, and stock |
| `GET` | `/api/products/{id}` | Returns single product record with parsed JSON attributes |
| `POST` | `/api/checkout` | ACID transactional checkout decrementing inventory with idempotency |

### AI Intent & Multilingual Voice
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/shop` | Intent search via Gemini Flash-Lite with fallback to token parser |
| `POST` | `/api/voice/stt` | Speech-to-Text via Gnani Prisma v3.0 (accepts audio file or base64) |
| `POST` | `/api/voice/tts` | Text-to-Speech via Gnani Timbre v3.0 (generates 24kHz WAV audio) |
| `POST` | `/api/voice/shop` | End-to-end voice shopping (transcribe → search → synthesize reply) |
| `GET` | `/api/voice/status` | Returns voice engine configuration status without exposing credentials |

### Merchant Operations & Demand Radar
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Inventory catalog, 7-day velocity, dynamic ROP, and active alerts |
| `GET` | `/api/admin/demand-radar` | Grouped demand clusters, estimated lost GMV, and live query feed |
| `POST` | `/api/admin/demand/fulfill` | Provisions unmet demand into live catalog stock (+15 units) |
| `POST` | `/api/admin/sourcing-rfp` | Generates commercial supplier procurement enquiry drafts |
| `POST` | `/api/admin/products/{id}/stock` | Manually updates inventory stock levels |
| `POST` | `/api/admin/restock-draft` | Generates supplier replenishment email drafts |

---

## Concurrency Validation & Stress Testing

ShelfSense includes a concurrency test harness to verify ACID isolation and prevent overselling race conditions under heavy load:

```bash
# Simulates 50 simultaneous checkout requests against a product with only 5 units in stock
python scripts/stress_test.py --product prod_001 --stock 5 --attempts 50
```

```text
Successful orders: 5
Rejected (insufficient stock): 45
Final stock: 0
PASS: Concurrency test passed. Zero oversell.
```

---

## Security & Architectural Standards

- **Zero Secrets in Code:** Credentials reside exclusively in `.env` and environment variables (enforced via `.gitignore`).
- **Idempotent Checkout:** UUID tokens prevent duplicate charges across unstable mobile connections.
- **Defensive API Client:** Cross-domain CORS protection and automatic error boundary wrappers prevent white-screen crashes.
- **Optimized Assets:** High-resolution local studio photography eliminates third-party CDN rate-limit failures (HTTP 429).

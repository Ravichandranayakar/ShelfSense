# ShelfSense

> AI-Powered Intent Commerce Platform & Merchant Demand Radar  
> Built for the Build Bengaluru 2.0 Hackathon

---

## Overview

ShelfSense is an intent-aware e-commerce engine designed to bridge the structural disconnect between consumer language and catalog inventory. Traditional e-commerce search relies on rigid keyword tokens and static taxonomy lookups. When shoppers describe functional needs, lifestyle contexts, or compound price constraints in natural language, standard search engines often fail, returning zero results. The shopper bounces, and the merchant remains unaware of the lost revenue opportunity.

ShelfSense solves this problem through a closed-loop architecture:
1. **Consumer Intent Engine:** Translates natural language queries into structured parametric constraints, displays transparent intent chips, and matches against live catalog attributes.
2. **Autonomous Demand Capture:** Automatically intercepts zero-result searches and explicit shopper requests, persisting them as structured demand signals.
3. **Merchant Demand Radar:** Aggregates unmet demand into actionable market clusters, computes estimated lost Gross Merchandise Value (GMV), and generates formal supplier Request for Proposal (RFP) procurement packets with one click.
4. **Defensible Inventory Allocation:** Computes real-time dynamic Reorder Points (ROP) using sales velocity and lead times, supported by a transactional outbox background worker.

---

## System Architecture

```
[ Client Layer: React 18 + Vite + Tailwind CSS ]
   |
   |-- POST /api/ai/shop (Natural Language Intent Query)
   |-- POST /api/checkout (Idempotent Atomic Checkout)
   |-- GET  /api/admin/demand-radar (Aggregated Demand Telemetry)
   |-- POST /api/admin/sourcing-rfp (Automated Procurement Generation)
   |
   v
[ Application Layer: FastAPI (Python 3.12) ]
   |
   |-- Dual Intent Parser: StepFun LLM (Function Calling) -> Deterministic Regex Fallback
   |-- ACID Checkout Handler: Row-level stock validation with BEGIN IMMEDIATE
   |-- Transactional Outbox Loop: 500ms background worker auditing stock thresholds
   |
   v
[ Persistence Layer: SQLite (WAL Mode) ]
   |-- products          (SKU, price_paise, stock, attributes_json)
   |-- orders            (idempotency_key, total_paise, status)
   |-- order_items       (order_id, product_id, quantity, unit_price)
   |-- outbox            (event_type, aggregate_id, payload, processed_at)
   |-- alerts            (type, evidence_json, draft_text, status)
   |-- demand_signals    (query, category, max_budget_paise, source)
```

---

## Core Capabilities

### 1. Natural Language Intent Commerce
- Translates unstructured prompts (e.g., *"monsoon-proof laptop bag for daily metro commute under INR 2,500"*) into discrete database filters (`category: bags`, `max_price_paise: 250000`, `required_attributes: {water_resistant: true}`).
- Uses StepFun (`step-3.7-flash`) tool calling with fallback to an internal deterministic token parser (`local_intent`), ensuring high availability even during network degradation.
- Interactive constraint chips allow users to inspect and modify extracted intent dynamically.

### 2. Autonomous Demand Capture & Commissioning Portal
- Zero-result searches silently record the raw query, parsed category, and budget ceiling into the `demand_signals` table.
- Shoppers who encounter a catalog gap can explicitly commission missing products, providing dimensional and material requirements.

### 3. Merchant Demand Radar
- Aggregates unstructured demand signals into grouped clusters using SQL grouping and statistical metrics.
- Quantifies unfulfilled market demand with estimated lost revenue (GMV) per cluster.
- Provides deep query telemetry and budget distribution analysis to validate customer willingness to pay.

### 4. Generative Sourcing RFP Engine
- Converts consumer descriptions into commercial procurement specifications with a single click.
- Produces supplier-ready Request for Proposal (RFP) drafts containing technical material specs, target unit economics, and estimated Minimum Order Quantities (MOQ).

### 5. Scientific Reorder Point (ROP) Inventory Allocation
- Replaces arbitrary replenishment thresholds with a dynamic supply chain formula:
  $$\text{ROP} = (\text{Daily Velocity } [D] \times \text{Supplier Lead Time } [L]) + \text{Safety Stock } [SS]$$
- Daily velocity is calculated from 7-day trailing order data.
- Alerts trigger automatically when stock dips below the computed threshold.

### 6. Atomic Checkout with Idempotency
- Uses immediate transaction locking (`BEGIN IMMEDIATE`) in SQLite Write-Ahead Logging (WAL) mode.
- Validates quantity ceilings and decrements inventory atomically, eliminating race conditions and overselling risks.
- Enforces unique idempotency keys to prevent duplicate orders.
- Writes order events to an `outbox` table in the same transaction to maintain event consistency.

---

## Technology Stack

| Layer | Technology | Specification |
| :--- | :--- | :--- |
| **Frontend** | React 18 | Vite 5.4, Tailwind CSS, Google Material Symbols |
| **Backend** | FastAPI | Python 3.12, Uvicorn ASGI Server, Pydantic v2 |
| **Database** | SQLite 3 | WAL Mode, Foreign Keys Enforced, 30s Busy Timeout |
| **AI Integration** | StepFun / OpenRouter | `step-3.7-flash` with Function Calling |
| **Architecture** | Transactional Outbox | Background Asyncio Task (500ms polling cycle) |

---

## Repository Structure

```
ShelfSense-store/
|-- backend/
|   |-- main.py              # FastAPI application, routes, models, outbox worker
|   |-- requirements.txt     # Python dependencies
|   |-- store.db             # Local SQLite database (auto-generated on launch)
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- SearchResultsView.jsx     # Intent search view & constraint chips
|   |   |   |-- MerchantDemandRadar.jsx   # Merchant intelligence console & RFP
|   |   |-- App.jsx          # Root application, router, storefront catalog, cart
|   |   |-- main.jsx         # Vite entry point
|   |   |-- styles.css       # Tailwind configuration & typography imports
|   |-- package.json         # Node.js dependencies
|   |-- vite.config.js       # Vite configuration
|-- scripts/
|   |-- smoke_stepfun.py     # AI provider connectivity verification script
|   |-- stress_test.py       # High-concurrency checkout race-condition tester
|-- .env.example             # Environment variable template
|-- .gitignore               # Strict exclusion of secrets, DB, and builds
|-- ATTRIBUTIONS.md          # Open-source and third-party asset acknowledgments
|-- README.md                # Technical platform documentation
```

---

## Getting Started

### Prerequisites
- Python 3.11 or higher
- Node.js 18 or higher with npm

---

### Step 1: Backend Setup

1. Open a terminal in the project root:
   ```bash
   cd ShelfSense-store
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Configure environment variables:
   ```bash
   # Copy the example file
   cp .env.example .env
   ```
   Edit `.env` if you have a StepFun or OpenRouter API key. If left unconfigured, the system automatically runs on the deterministic regex fallback engine without error.

5. Start the backend server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   The backend API will be available at `http://127.0.0.1:8000`. You can inspect the interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`.

---

### Step 2: Frontend Setup

1. Open a second terminal:
   ```bash
   cd ShelfSense-store/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be live at `http://localhost:5173` (or `http://localhost:5174`).

---

## Concurrency & Stress Testing

ShelfSense includes a dedicated concurrent stress testing suite to verify ACID compliance and prevent overselling race conditions.

To execute 50 simultaneous checkout requests against a product with only 5 units in stock:

```bash
python scripts/stress_test.py --product prod_001 --stock 5 --attempts 50
```

### Expected Output
```text
Successful orders: 5
Rejected (insufficient stock): 45
Final stock: 0
PASS: Concurrency test passed. Zero oversell.
```

---

## API Reference

### Catalog & Commerce
- `GET /api/products` - Returns filtered products by keyword, category, price ceiling, and stock status.
- `GET /api/products/{id}` - Returns full product record including parsed JSON attributes.
- `POST /api/checkout` - Atomic transaction handling line items, stock validation, and outbox event enqueueing.

### AI & Intent Engine
- `POST /api/ai/shop` - Processes conversational queries; executes tool calling or regex fallback; logs zero-result demand signals.
- `POST /api/demand/request` - Captures explicit customer commissioning requests.

### Merchant & Procurement Operations
- `GET /api/admin/overview` - Returns catalog inventory, 7-day velocity, computed Reorder Points, and open restock alerts.
- `GET /api/admin/demand-radar` - Returns aggregated unmet demand grouped by query, category, and budget.
- `POST /api/admin/sourcing-rfp` - Generates formal supplier procurement enquiry drafts.
- `POST /api/admin/products/{id}/stock` - Updates product stock and re-evaluates low-stock triggers.
- `POST /api/admin/restock-draft` - Regulates and produces supplier replenishment email drafts.

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `STEPFUN_API_KEY` | API Key for StepFun or OpenRouter LLM | Optional |
| `STEPFUN_BASE_URL` | Base URL for LLM API | `https://api.stepfun.ai/v1` |
| `STEPFUN_MODEL` | Target language model | `step-3.7-flash` |
| `AI_TIMEOUT_SECONDS`| Maximum latency ceiling before dropping to fallback | `25` |
| `LOW_STOCK_THRESHOLD`| Default threshold for stock replenishment triggers | `10` |
| `DATABASE_PATH` | Path to SQLite database file | `./backend/store.db` |

---

## Security & Compliance

- **No Secrets in Source:** All API keys and environment configurations are strictly isolated to `.env` (enforced via `.gitignore`).
- **Idempotency Safeguards:** Every checkout call requires or auto-generates a unique UUID idempotency key to prevent double billing.
- **Transactional Integrity:** Immediate SQLite WAL write locks prevent inconsistent inventory states.

# Synqora — Build Bengaluru 2.0 Finale Blueprint

**Problem statement:** Build the Online Store  
**Team:** Synqora, 3 members  
**Goal:** ship a real store, then add one defensible AI + data differentiator.

> Recommendation: build **“Intent-to-Inventory”** — an online store where a shopper describes a need, StepFun converts it into catalog-grounded recommendations, checkout updates real inventory, and Kafka-driven events trigger merchant restock/demand insights.

---

## 1. What the research actually supports

### StepFun capabilities

- `step-3.7-flash` is documented as a multimodal reasoning model with native image/video understanding and reliable `tools` / `tool_choice` orchestration. It is a good default for a shopping concierge. [1](https://platform.stepfun.ai/docs/en/guides/models/step-3.7-flash)
- `step-5-preview` is documented for agentic work, text/image/video input, tool calling, streaming, JSON Mode, and JSON Schema structured output. It can be used for heavier merchant reasoning if the key has access and latency is acceptable. [3](https://platform.stepfun.ai/docs/en/guides/models/step-5-preview)
- StepFun’s Chat Completions API is OpenAI-compatible and supports image URL/base64 input and tool calling, but you should still test the exact features on your own key/model/provider. [2](https://platform.stepfun.ai/docs/en/api-reference/chat/chat-completion-create)
- Structured output is not enough by itself: the application must still validate business rules such as price limits, stock, product IDs, and cart totals. StepFun’s migration/structured-output docs support JSON Schema usage, while the tool-calling pattern requires your backend to execute the actual function. [3](https://platform.stepfun.ai/docs/en/guides/developer/openai)

**Correction to the other agent:** do not say “100% OpenAI compatible” as a blanket guarantee. Say: “StepFun exposes an OpenAI-compatible Chat Completions API; we verified text, image, tool-calling, and structured-output behavior on our enabled models.”

### Agent Studio / Studio

The public Studio surface currently presents chat, search, showcase, playground, and assets. StepFun’s platform page describes Studio as a way to try models in the browser and then wire up the API. [5](https://studio.stepfun.ai/) [4](https://stepfun.ai/)

**Use it for:** prompt prototyping, comparing model outputs, and preparing demo examples.  
**Do not assume:** that Studio automatically gives you a production agent runtime, database access, Kafka triggers, or a deployable workflow API unless your logged-in account explicitly exposes that.

### Aiven capabilities and free-tier reality

If Aiven is part of your track/perks, the useful combination is:

- PostgreSQL: source of truth for products, carts, orders, inventory, outbox.
- Kafka: event bus for order/stock/search events.
- OpenSearch: product search and filtering.

Aiven documents an OpenSearch sink connector from Kafka, but it requires Kafka Connect enabled or a dedicated Kafka Connect cluster. [2](https://aiven.io/docs/products/kafka/kafka-connect/howto/opensearch-sink)

Free-tier limits matter:

- PostgreSQL free tier has `max_connections = 20` and no connection pooling. [3](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
- Kafka free tier includes 5 topics, 2 partitions each, 3-day retention, and no service integrations. [4](https://aiven.io/free-kafka)
- OpenSearch free tier is for prototyping, has fixed limits, and can idle-shutdown. [1](https://aiven.io/docs/products/opensearch/concepts/opensearch-free-tier)

**Correction to the other agent:** do not plan around managed Kafka Connect on the free Kafka tier unless your hackathon credits provide a paid/Connect-enabled service. The safer finale path is a small custom Python consumer that reads Kafka and writes to OpenSearch.

### Commerce research: what problem is worth solving?

- Checkout friction is real: Baymard reports extra costs, slow delivery, distrust, forced account creation, and complex checkout as major abandonment reasons. This supports transparent totals, guest checkout, and a short checkout flow. [1](https://baymard.com/blog/cart-abandonment-rate) [2](https://baymard.com/blog/reduce-cart-abandonment)
- Product fit uncertainty is a known information problem in online retail; fit information can affect conversion and returns. This supports grounded product Q&A and clear specs, but do not let the model guess fit. [3](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2371747) [4](https://www.hbs.edu/faculty/Pages/item.aspx?num=53231)
- AI shopping assistants and merchant AI assistants already exist. Shopify Sidekick and Perplexity shopping are examples. Therefore, “we added an AI chatbot” is not novel by itself. [1](https://www.shopify.com/sidekick) [2](https://help.shopify.com/en/manual/ai-powered-tools/sidekick) [1](https://www.perplexity.ai/hub/blog/shop-like-a-pro) [2](https://www.perplexity.ai/hub/blog/shopping-that-puts-you-first)

**Defensible angle:** not “first AI store,” but a working closed loop:

> Shopper intent → grounded product search → safe checkout → inventory event → merchant action.

---

## 2. Recommended product

### Working name

**Synqora ShelfSense**  
Tagline: *“An online store that understands what you need and keeps inventory honest.”*

### Demo niche

Do not build a giant marketplace. Seed 24–40 realistic products in one coherent niche, for example:

- campus commute gear: backpacks, rain jackets, shoes, laptop sleeves, bottles;
- or budget electronics accessories.

Each product should have structured attributes:

```json
{
  "id": "prod_001",
  "title": "Water-resistant 14-inch laptop backpack",
  "category": "bags",
  "price_paise": 249900,
  "stock": 8,
  "attributes": {
    "water_resistant": true,
    "laptop_size_inches": 14,
    "color": "black"
  }
}
```

### Core shopper flow

1. Browse products.
2. Ask: “I need a water-resistant bag for a 14-inch laptop under ₹2,500.”
3. Optional: upload a reference photo.
4. StepFun extracts constraints and calls `search_products`.
5. Backend queries OpenSearch, then rechecks live stock/price from PostgreSQL.
6. UI shows only real products with reasons tied to catalog fields.
7. Shopper clicks **Add to cart**.
8. Guest checkout creates an order and decrements stock atomically.

### Core merchant flow

1. Order committed in PostgreSQL.
2. Same transaction writes an `outbox` event.
3. Publisher sends event to Kafka.
4. Consumer updates OpenSearch stock projection.
5. If stock crosses threshold, ops worker creates an alert.
6. StepFun drafts a restock brief using real stock and recent order evidence.
7. Merchant reviews/approves draft. No automatic purchasing or email sending in MVP.

### Optional “demand gap” feature

If search returns no valid matches, log a `search_unsatisfied` event with the extracted constraints. Admin can show:

- “3 shoppers wanted water-resistant laptop bags under ₹2,000; no in-stock match.”
- StepFun drafts a sourcing/restock suggestion.

This is more interesting than a generic restock email because it connects customer demand to merchant action.

---

## 3. What makes it more than a simple store

| Layer | Simple store | Synqora differentiator |
|---|---|---|
| Search | Keyword filter | Natural-language/image intent → structured catalog query |
| Recommendations | Static list | Only real product IDs, live price/stock, constraint explanations |
| Checkout | Basic order form | Atomic multi-item checkout + idempotency key |
| Inventory | Manual stock field | PostgreSQL truth → Kafka event → OpenSearch projection |
| Merchant ops | Static admin table | Low-stock/demand-gap alert + evidence-based draft |
| AI safety | Model can say anything | Whitelisted tools, schema validation, human approval for actions |

The strongest demo is not “AI talks nicely.” It is:

> “The AI cannot recommend a fake product, cannot oversell stock, and can trigger a real merchant workflow after checkout.”

---

## 4. Architecture

```text
React storefront + admin
        |
        v
FastAPI backend
        |
        +--> PostgreSQL: products, carts, orders, outbox, alerts
        |
        +--> StepFun API: intent extraction, tool calls, restock draft
        |
        +--> OpenSearch: product search index
        |
        +--> Kafka producer: outbox publisher
                 |
                 v
              Kafka topics
                 |
                 +--> search-index consumer --> OpenSearch
                 +--> ops consumer --> alerts + StepFun draft
```

### Source of truth rules

- PostgreSQL is authoritative for price, stock, orders, and cart state.
- OpenSearch is a search projection. It may lag.
- Kafka is an event transport, not the inventory ledger.
- StepFun proposes tool calls and text; the backend executes actions.
- The LLM never directly writes SQL, decrements stock, or completes checkout.

### Transactional outbox

Do not write to PostgreSQL and Kafka as two independent best-effort writes. Use the transactional outbox pattern to avoid the dual-write problem. [1](https://developer.confluent.io/courses/microservices/the-transactional-outbox-pattern/) [4](https://www.confluent.io/blog/dual-write-problem/)

Checkout transaction:

1. Validate cart and idempotency key.
2. Lock relevant product rows or use conditional stock updates.
3. Verify stock for every item.
4. Decrement stock.
5. Insert order + order items.
6. Insert outbox event.
7. Commit.

After commit, a publisher sends the outbox event to Kafka. Consumers must be idempotent because Kafka delivery can be retried.

---

## 5. Minimal data model

```text
products
  id, sku, title, category, description, price_paise, stock,
  attributes_json, version, updated_at

carts
  id, session_id, created_at

cart_items
  cart_id, product_id, quantity

orders
  id, idempotency_key, session_id, total_paise, status, created_at

order_items
  order_id, product_id, quantity, unit_price_paise

outbox
  id, event_type, aggregate_id, payload_json, created_at, published_at

processed_events
  consumer_name, event_id, processed_at

alerts
  id, type, product_id, evidence_json, draft_text, status, created_at
```

Use integer paise for money. Do not use floating-point rupees for totals.

---

## 6. AI tool contracts

### Shopper tool

```json
{
  "name": "search_products",
  "description": "Search the live catalog using structured constraints.",
  "parameters": {
    "query": "string",
    "category": "string|null",
    "max_price_paise": "integer|null",
    "required_attributes": "object",
    "in_stock_only": "boolean",
    "limit": "integer"
  }
}
```

Backend response should include only canonical catalog data:

```json
{
  "products": [
    {
      "id": "prod_001",
      "title": "Water-resistant 14-inch laptop backpack",
      "price_paise": 249900,
      "stock": 8,
      "matched_attributes": {
        "water_resistant": true,
        "laptop_size_inches": 14
      }
    }
  ],
  "no_results_reason": null
}
```

Rules:

- Model may explain matches, but may not invent product IDs, prices, stock, or discounts.
- If no product satisfies constraints, say so and suggest relaxing a constraint.
- Add-to-cart should be a normal UI action, not an autonomous LLM action.
- Checkout should never be triggered by the model.

### Merchant tool

```json
{
  "name": "create_restock_draft",
  "description": "Create a draft restock brief for human review.",
  "parameters": {
    "product_id": "string",
    "current_stock": "integer",
    "recent_units_sold": "integer",
    "threshold": "integer",
    "suggested_quantity": "integer",
    "reason": "string"
  }
}
```

The backend validates the numbers against PostgreSQL/Kafka-derived aggregates before saving the draft.

---

## 7. Scope control

### Must build

- Product grid and product detail.
- Cart and guest checkout.
- PostgreSQL inventory decrement.
- StepFun text concierge with `search_products`.
- OpenSearch-backed search, or PostgreSQL search fallback if Aiven is not required.
- Basic admin order/stock view.
- One end-to-end demo path.

### Should build if core works

- Kafka outbox publisher.
- OpenSearch stock consumer.
- Low-stock alert + StepFun restock draft.
- Image-to-search.
- Demand-gap logging.
- Concurrency stress test.

### Cut first if time runs out

- Voice shopping.
- Music/audio generation.
- Real payment gateway.
- Real supplier email sending.
- User accounts/login.
- Multi-vendor marketplace.
- Complex microservices.
- Autonomous purchasing agents.

---

## 8. Acceptance tests

### Commerce correctness

- 50 concurrent checkout attempts for a product with stock 5.
- Expected: 5 successful orders, 45 rejected, final stock 0.
- No negative stock.
- Duplicate idempotency key does not create a second order.
- Cart total equals sum of order item totals.

### AI correctness

- “Under ₹2,500” never returns a product above 250000 paise.
- “In stock only” never returns stock 0.
- Every recommended product ID exists in PostgreSQL.
- No-results query does not hallucinate a product.
- Image query falls back gracefully if vision fails.
- Prompt injection in product description does not change tool permissions.

### Event pipeline

- Order commit creates exactly one outbox row.
- Publisher sends event to Kafka.
- Consumer updates OpenSearch stock.
- Replayed event does not duplicate alert or corrupt stock.
- Admin dashboard shows order, stock change, and alert draft.

---

## 9. Three-person execution plan

Use relative time because the uploaded rules PDF and event page disagree on exact start/end time.

### Person A — backend/data

- PostgreSQL schema and seed data.
- Cart/checkout APIs.
- Atomic inventory transaction.
- Outbox publisher.
- Kafka consumer for search indexing.

### Person B — frontend

- Storefront, product cards, filters, cart, checkout.
- AI assistant drawer.
- Admin dashboard.
- Loading/error/empty states.
- Mobile-friendly demo layout.

### Person C — AI/integration/demo

- StepFun smoke test.
- Tool schemas and prompt.
- Search tool implementation with backend.
- Restock/demand-gap draft.
- Test script, demo video, pitch screenshots.

### Milestones

| Time | Milestone |
|---|---|
| T+0–2 | Confirm rules, provision services, smoke-test StepFun, repo setup |
| T+2–6 | Product grid, cart, checkout, PostgreSQL stock decrement |
| T+6–10 | StepFun concierge + grounded search |
| T+10–14 | Kafka/outbox/admin pipeline |
| T+14–18 | Stress test, image search if stable, polish |
| T+18–21 | Freeze, backup video, real screenshots, submission package |
| T+21–24 | Rehearse, fix only critical bugs, submit early |

---

## 10. Two-minute demo script

1. **Problem:** “Online stores fail when search does not understand intent and inventory is not trustworthy.”
2. **Normal store:** show product grid and cart.
3. **AI intent:** ask for a water-resistant 14-inch laptop bag under ₹2,500.
4. **Grounding:** show tool call/result and real product IDs/prices/stock.
5. **Checkout:** complete guest checkout.
6. **Inventory truth:** show PostgreSQL stock decrement.
7. **Event pipeline:** show Kafka event and OpenSearch stock update.
8. **Merchant ops:** show low-stock alert and StepFun restock draft.
9. **Stress test:** run 50 concurrent orders against stock 5; show 5 success / 45 rejected / stock 0.
10. **Close:** “This is not just a chatbot. It is a closed loop from customer intent to safe commerce to merchant action.”

---

## 11. Hackathon compliance notes

From the uploaded **Build Bangalore Hackathon 2.0 Rules & Regulations (2).pdf**:

- The PDF says hackathon start/end is **10:00 AM to 10:00 AM**, while the event page you pasted says **9:00 AM to 9:00 AM**. Confirm the official deadline with organizers.
- Section 11 says **Qwen Studio/Qwen AI is mandatory** for research, content, PPT preparation, and documentation.
- Section 11 says **Google Antigravity IDE is mandatory** for coding and project development.
- Projects must be developed during the official hackathon window, subject to the organizer’s pre-existing code policy.
- Third-party APIs, libraries, datasets, and AI tools are allowed but must be disclosed.

Practical compliance:

- Use this Qwen session for research/blueprint/PPT content.
- Do the actual implementation in Google Antigravity.
- Keep a simple `ATTRIBUTIONS.md` listing StepFun, Aiven, React, FastAPI, Kafka client, OpenSearch client, datasets/images, and AI assistance.
- Keep commit history and demo evidence from the hackathon window.

---

## 12. Open decisions before coding

1. **Is Aiven mandatory for your track, or only a perk?**  
   If mandatory: use PostgreSQL + Kafka + OpenSearch with custom consumers.  
   If optional: PostgreSQL + StepFun + one async worker may be enough; add Kafka/OpenSearch only if they improve the demo.

2. **What was in the Round 2 PPT?**  
   The file named `Build the Online Store (1).pdf` was mentioned by the other agent, but it is not in the uploaded files I can see. Upload it so the finale build does not drift from the shortlisted pitch.

3. **Which StepFun access is enabled?**  
   Direct StepFun API and OpenRouter may expose different model IDs/features. Run a smoke test for text, tool calling, image input, and JSON schema before committing to the AI flow.

---

## 13. Antigravity-ready first task

Paste this into Google Antigravity after the decisions above are confirmed:

```text
Build a 24-hour hackathon MVP called Synqora ShelfSense.

Stack:
- Frontend: React + Vite + Tailwind
- Backend: FastAPI + SQLAlchemy/psycopg
- Database: PostgreSQL
- Search: OpenSearch if Aiven is required; otherwise PostgreSQL full-text fallback
- Events: Kafka if Aiven is required; otherwise a lightweight outbox worker
- AI: StepFun OpenAI-compatible Chat Completions API

Must implement:
1. Product seed data with integer paise prices and stock.
2. Product grid, product detail, cart, guest checkout.
3. Atomic checkout transaction with idempotency key and no negative stock.
4. Transactional outbox table.
5. StepFun shopping assistant that calls a whitelisted search_products tool.
6. Backend validates all tool arguments and returns only real catalog products.
7. Admin page showing orders, stock, and low-stock alerts.
8. Test script: 50 concurrent checkouts against stock 5 must produce 5 successes and 45 failures.

Do not implement:
- real payments
- login
- voice
- autonomous purchasing
- automatic supplier emails

Security:
- API keys only in .env
- no secrets in frontend
- rate-limit AI endpoint
- timeout and fallback to keyword search
- treat product text as untrusted data
```

---

## Bottom line

Build the store first. Make the AI **catalog-grounded**. Make checkout **inventory-safe**. Make the merchant workflow **event-driven**. That is a much stronger finale story than “online store + chatbot,” and it uses StepFun and Aiven in ways that are real, testable, and demoable.

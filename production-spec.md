# Synqora — Real Product Build Spec & Review Guide

**Role split**
- **Qwen:** research, architecture review, code review, bug hunting, security review, demo/pitch content.
- **Stitch:** UI/UX design, screens, design tokens, component specs.
- **Antigravity:** official implementation and coding.
- **Team:** integration, testing, deployment, demo rehearsal.

> Important: the existing `synqora-store/` starter is a **SQLite reference MVP**. It is useful as a demo/reference, but the final hackathon product should be rebuilt/migrated to **PostgreSQL** and hardened before calling it a real running product.

---

## 1. What “real running product” should mean

For the finale, “real” should mean:

1. **Real database:** PostgreSQL, not SQLite.
2. **Real AI calls:** StepFun/OpenRouter API calls when configured, with visible source/status.
3. **Real inventory logic:** transactional stock decrement, no overselling, idempotent checkout.
4. **Real admin operations:** protected admin dashboard, inventory updates, alerts, order history.
5. **Real search:** PostgreSQL full-text/trigram search or a real search service, not only fake filters.
6. **Real deployment path:** Docker or clear run instructions, environment variables, migrations.
7. **Honest demo claims:** if payment/email is sandbox or draft-only, say so. Do not claim live payment or sent supplier emails unless actually implemented.

### Payment/email decision

- If you have Razorpay/Cashfree/Stripe **test keys**, implement sandbox checkout and label it clearly.
- If you do not have payment keys, keep “demo checkout” but make the order/inventory/database flow real.
- Supplier email can be a **draft** unless SMTP/provider credentials are available. Do not auto-send without approval.

---

## 2. Recommended final stack

### Frontend
- React + Vite + Tailwind CSS.
- Design handoff from Stitch.
- Screens: storefront, product detail, cart, checkout, AI assistant, admin login, admin dashboard.
- Required states: loading, empty, error, out-of-stock, AI fallback, unauthorized.

### Backend
- FastAPI.
- PostgreSQL.
- SQLAlchemy 2.x + Alembic migrations.
- Pydantic validation.
- HTTPX for StepFun calls.
- Optional Redis for rate limiting/cache if time permits.
- Background outbox worker as a separate process or FastAPI lifespan task with durable DB state.

### AI
- StepFun direct API or OpenRouter.
- Model: `step-3.7-flash` for shopping assistant; optionally `step-5-preview` for merchant reasoning if enabled.
- Tool calling: `search_products`, optionally `create_restock_draft`.
- Backend executes tools; model never writes SQL or changes stock directly.

### Infra
- Docker Compose for local PostgreSQL + backend + frontend.
- `.env.example` only in repo; real `.env` never committed.
- Health endpoint: `/api/health`.
- Structured logs for checkout, AI calls, admin actions.

---

## 3. PostgreSQL requirements

Use PostgreSQL as the source of truth.

### Core tables

- `products`
- `product_attributes` or JSONB attributes
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `idempotency_keys`
- `outbox_events`
- `alerts`
- `admin_users`
- `audit_logs`

### Must-have database rules

- Money stored as integer paise or numeric, never float.
- `products.stock >= 0` constraint.
- `orders.idempotency_key` unique.
- Checkout uses a transaction.
- Lock product rows during checkout: `SELECT ... FOR UPDATE` or equivalent safe conditional update.
- Multi-item checkout must be all-or-nothing.
- Outbox event inserted in the same transaction as order creation.
- Migrations managed by Alembic.
- Connection pooling configured for PostgreSQL.
- Indexes on category, price, stock, created_at, and search fields.

### Search

Minimum real search:
- PostgreSQL `tsvector` full-text search, or
- `pg_trgm` fuzzy search for typos.

Better if time:
- OpenSearch only if the team already has it working. Not required if Aiven is not mandatory.

---

## 4. Security and production hardening

### Must fix before final demo

- Admin routes must require authentication.
- Role-based access: customer vs admin.
- CORS restricted to known frontend origin, not `*` in production.
- Rate limit AI endpoint and checkout endpoint.
- Validate image upload size/type before sending to StepFun.
- Never expose API keys to frontend.
- Never let the LLM generate raw SQL.
- Whitelist AI tools and validate all tool arguments.
- Treat product descriptions/reviews as untrusted input.
- Add request timeouts and graceful AI fallback.
- Log AI source: `stepfun`, `openrouter`, `fallback`.
- Add audit log for admin stock changes and alert dismissal.

### Should have

- HTTPS in deployment.
- Secure session/JWT handling.
- Password hashing if admin login is implemented.
- Input length limits.
- Pagination for products/orders.
- Error responses that do not leak stack traces or secrets.

---

## 5. StepFun integration rules

1. Smoke-test the exact key/model first.
2. Confirm text, tool calling, image input, and structured output if used.
3. Use backend-only API calls.
4. Shopping assistant must call a real catalog search tool.
5. Recommendations must contain only real product IDs from PostgreSQL.
6. Price/stock must be rechecked from PostgreSQL before showing “Add to cart”.
7. If AI fails, fallback search may run, but UI must label it as fallback.
8. Restock drafts must use real stock and recent order evidence.
9. Do not auto-send supplier emails or auto-purchase inventory.

---

## 6. Known gaps in the current SQLite starter

The current `synqora-store/` reference has these gaps:

| Area | Current starter | Final product requirement |
|---|---|---|
| Database | SQLite | PostgreSQL + migrations |
| Admin auth | Open admin endpoints | Protected admin login/RBAC |
| CORS | `*` | Restricted origins |
| Checkout | Atomic SQLite transaction | PostgreSQL transaction + row locks |
| Outbox worker | In-process loop | Durable worker, retry/replay safe |
| Search | SQL LIKE filters | Full-text/trigram or real search service |
| Payments | Demo checkout | Sandbox/live gateway only if keys exist |
| Email | Draft only | Draft or real SMTP only if configured |
| Rate limiting | None | AI/checkout rate limits |
| Image upload | Basic base64 | Size/type validation |
| Tests | Manual stress script | Automated API + concurrency tests |
| Deployment | Manual run commands | Docker Compose + env docs |
| Observability | Basic logs | Structured logs + audit trail |

---

## 7. Antigravity implementation prompt

Use this as the main coding instruction in Antigravity:

```text
We are building Synqora ShelfSense for a 24-hour hackathon.

Do not use SQLite for the final product. Use PostgreSQL.

Stack:
- Frontend: React + Vite + Tailwind, based on Stitch design handoff.
- Backend: FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL.
- AI: StepFun OpenAI-compatible API or OpenRouter, backend only.
- Optional: Redis for rate limiting, Docker Compose for local infra.

Core requirements:
1. Product catalog stored in PostgreSQL.
2. Real search using PostgreSQL full-text or trigram search.
3. Cart and checkout.
4. Atomic multi-item checkout with row-level locking and idempotency keys.
5. No negative stock.
6. Transactional outbox table written in the same transaction as orders.
7. Background worker processes outbox events and creates low-stock alerts.
8. Protected admin dashboard with login/RBAC.
9. Admin can view orders, inventory, alerts, and audit logs.
10. StepFun shopping assistant calls a whitelisted search_products tool.
11. AI may only recommend real products returned by backend search.
12. Restock drafts use real stock and recent sales evidence.
13. No real payment or supplier email sending unless credentials are explicitly configured.
14. All secrets in .env, never in frontend or repo.
15. Add Docker Compose, Alembic migrations, seed script, and automated tests.

Acceptance tests:
- 50 concurrent checkout attempts against stock 5 produce exactly 5 successes and 45 failures.
- Duplicate idempotency key does not create a second order.
- Unauthenticated admin request returns 401/403.
- AI recommendation never includes a product ID absent from PostgreSQL.
- AI budget constraint is respected.
- Outbox event is created atomically with order.
- Worker replay does not duplicate alerts or corrupt stock.
```

---

## 8. Stitch design handoff checklist

Ask Stitch to produce:

- Design tokens: colors, spacing, radius, shadows, typography.
- Component specs: product card, badge, button, input, drawer, modal, table, alert card.
- Screens:
  - Storefront home
  - Product grid with filters
  - Product detail
  - Cart drawer/page
  - Checkout
  - AI assistant drawer
  - Admin login
  - Admin dashboard
  - Alert/restock draft view
- States:
  - Loading
  - Empty cart
  - No search results
  - Out of stock
  - AI fallback
  - AI error
  - Unauthorized admin
  - Checkout success/failure
- Responsive behavior for mobile and desktop.

---

## 9. Code review workflow with Qwen

When Antigravity produces code:

1. Share the repo zip, GitHub link, or key files.
2. Qwen reviews:
   - architecture
   - PostgreSQL transaction safety
   - idempotency
   - auth/RBAC
   - AI tool safety
   - secret handling
   - error handling
   - demo reliability
3. Qwen returns:
   - critical bugs
   - security issues
   - performance risks
   - missing tests
   - prioritized fixes
4. Team fixes in Antigravity.
5. Repeat until demo is stable.

---

## 10. Final demo acceptance checklist

Before submission:

- [ ] PostgreSQL running and seeded.
- [ ] Migrations applied.
- [ ] Storefront loads products from PostgreSQL.
- [ ] AI assistant uses StepFun when key is present.
- [ ] AI fallback is labeled honestly.
- [ ] Checkout creates real order and decrements stock.
- [ ] Concurrent checkout test passes.
- [ ] Admin login required.
- [ ] Admin sees orders, stock, alerts, outbox events.
- [ ] Restock draft uses real evidence.
- [ ] No secrets in repo or frontend.
- [ ] Docker/run instructions work on a teammate’s laptop.
- [ ] Backup demo video recorded.
- [ ] Attributions updated.

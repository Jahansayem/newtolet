# NewTolet — Customer Orders (admin dashboard + agent REST API)

## Context

NewTolet's paid house-search service (HOUSE_SEARCH, 500 BDT) is run from Messenger with no shared record. The team and the AI inbox agents need one source of truth per paid request: requirements, who is searching, payments claimed vs verified, and listings found. This plan adds that record, an admin "Customer Orders" section, and a REST API for agents.

**What discovery found (differs from the brief's assumptions)**

- Stack: Next.js 16 App Router, **static export**, plain JS, Tailwind 4 + DaisyUI, self-hosted Supabase (Postgres + Edge Functions) on the VPS. No server routes, so the API is a Supabase Edge Function.
- An older orders feature is live: `public.orders` (uuid id, 1000 BDT "7 days" package, 13 rows), website form `src/Component/Navber/CreateOrderForm.jsx`, admin tab `?tab=orders`, job feed and `payment_transactions.order_id` depend on it. Its payment step is fake (no payment recorded).
- Admin writes are only possible through `SECURITY DEFINER` RPCs (`assert_admin_permission`, `log_admin_action`); direct table writes were removed by `20261101090000_lock_admin_direct_writes.sql`.
- Roles are `super_admin / moderator / finance / support / content_manager` with permissions (`orders.manage`, `payments.review`). There is no "staff" role.
- `agent-listings` has labelled API keys with constant-time compare, but no scopes, idempotency, rate limit, or `{success,...}` envelope.
- Neither bKash number nor the 500 BDT price exists in the repo. No local DB, no migration tracker; SQL is verified by rolled-back dry runs on the VPS.

**Decisions you confirmed**

| Topic | Decision |
|---|---|
| Old orders | One list with a **Created by** filter: customer / AI agent / human agent. Public website front end is **not modified**; backend only. |
| API base URL | `https://www.newtolet.com/api/v1` (nginx proxy to the Edge Function). |
| Payment verify | `payments.review` permission (super_admin + finance). |
| Visibility | Everyone with `orders.manage` sees all orders; filter by assignee. |
| PAID_AD (50 BDT) | **Skipped.** v1 is HOUSE_SEARCH only; no paid-ad order type, flow, price or seed. |

**Defaults I am assuming (say so if any is wrong)**

- Order number format `NT-2026-0001`, counter restarts each year.
- Agents create the order at requirements-complete (agent-side behaviour; the API allows it).
- Website-form orders appear in the new list through a **database trigger** that mirrors each new `public.orders` row (and the 13 existing rows) into the new table as `created_via = customer`. Their charge is copied from the old row's `cost` (1000 BDT), because that is what the customer was shown. The old table, form, job feed and old admin tab are untouched.
- Search can continue after payment: `PAYMENT_VERIFIED → SEARCHING_BY_*` is allowed. This is needed for the requested seed order "PAYMENT_VERIFIED + SEARCHING_BY_HUMAN", which a single status column cannot otherwise express; payment state is shown by `payment_status` / `payment_verification`.
- Order API keys are separate from the listings keys (`ORDERS_AGENT_API_KEYS`, `ORDERS_ADMIN_API_KEYS`).

---

## 1. Data model

One migration: `supabase/migrations/20261116090000_customer_orders.sql` (repo style: header comment, single `begin…commit`, re-runnable, closing `do $$` assertions; text + CHECK, no enums; `timestamptz`). Rollback: `scripts/deploy/supabase-selfhost/rollback-customer-orders.sql`.

**`customer_orders`**
- `id uuid pk`, `order_no text unique` (`NT-YYYY-NNNN`, set by BEFORE INSERT trigger from `customer_order_counters(year, last_no)` with a row lock; client value ignored, frozen on update — same idea as `assign_property_id_number()`).
- `type` (CHECK allows only HOUSE_SEARCH; the column exists so the API shape matches the spec), `status`, `search_mode` (AI | HUMAN | null — last searcher, kept after the status moves on), `search_taken_over_by text`.
- `created_via` (customer | ai_agent | human_agent), `created_by_label text`, `source` (messenger | lead_generation | manual | phone | website).
- Customer: `customer_user_id uuid null → users`, `customer_name`, `customer_phone` (stored as `01XXXXXXXXX`), `facebook_name`, `facebook_thread_url`. CHECK: name present and (phone or thread URL) present.
- Requirements: `area`, `rooms`, `budget_min`, `budget_max`, `move_in_date date`, `tenant_type` (family | bachelor), `gas`, `bathrooms`, `balconies`, `facilities`, `requirement_notes`.
- `service_charge_bdt int` (set server-side only), `assigned_to uuid null → users`, `follow_up_at timestamptz null`, `payment_claimed_at`, `payment_verified_at` (start of the 7-day refund window).
- `idempotency_key text` (unique per key label), `legacy_order_id uuid null unique → orders`, `deleted_at`, `deleted_by_label`, `created_at`, `updated_at` (`set_updated_at()` trigger).
- Indexes: `customer_phone`, `status`, `assigned_to`, `created_at desc`, `created_via`.

**`customer_order_payment_claims`** — `order_id`, `amount_bdt int > 0`, `trx_id`, `sender_last4` (4 digits), CHECK at least one of the two, `status` (CLAIMED | VERIFIED | REJECTED), `claimed_by_type/label`, `claimed_at`, `reviewed_by uuid`, `reviewed_by_label`, `reviewed_at`, `review_note`. Unique `(order_id, trx_id)`.

**`customer_order_matches`** — `order_id`, `reference_id` (internal), `property_id uuid null → properties`, `general_location`, `rent`, `verification_status` (verified | unverified), `owner_contact_phone`, `exact_address` (internal, masked by the API), `owner_permission bool`, `owner_permission_recorded_by/at`, `removed_at`, actor columns.

**`customer_order_status_history`**, **`customer_order_notes`**, **`customer_order_activity`** — append-only (BEFORE UPDATE/DELETE trigger raising, same as `admin_audit_log_immutable()`). Each row carries `actor_type` (admin | api_key | system), `actor_id`, `actor_label`. History stores `from_status`, `to_status`, `reason`. Activity stores `action`, `before`, `after`.

**`customer_order_transitions`** — `(from_status, to_status, requires_reason, agent_allowed)`, seeded in the migration.

**`customer_order_api_requests`** — fixed-window rate-limit counter per key label.

**View `customer_orders_enriched`** (`security_invoker = true`) — every order column plus derived values, never stored:
- `amount_paid` = sum of non-rejected claims; `amount_verified` = sum of VERIFIED claims.
- `amount_due` = `greatest(charge − amount_paid, 0)`; `overpaid` = `amount_paid > charge`.
- `payment_status`: PENDING (0) / PARTIAL_PAID / PAID (`≥ charge`).
- `payment_verification`: VERIFIED when `amount_verified ≥ charge`; CLAIMED when any non-rejected claim; else UNVERIFIED.
- `listings_found_count`, `listings_verified_count`, `listings_unverified_count` from non-removed matches.
- `contact_unlocked` = status in (PAYMENT_VERIFIED, MATCHED, COMPLETED or searching after verification) and `amount_verified ≥ charge`.

**Access** — RLS on for all tables; `revoke all from public, anon, authenticated`; `grant select to authenticated` with policy `(select public.admin_has_permission('orders.manage'))`; `grant all to service_role`. No write policies: all writes go through functions.

**Mirror of website orders** — `AFTER INSERT` trigger on `public.orders` calls the core create function (`created_via = customer`, `source = website`, name/phone from `users`, charge = `NEW.cost`), wrapped in an exception handler so a failure can never block a website order. Backfill of the existing rows in the same migration, keyed by `legacy_order_id`.

## 2. Status machine (enforced in SQL, one place for both dashboard and API)

Main path:

`PENDING → REQUIREMENTS_COLLECTED → SEARCHING_BY_AI ⇄ SEARCHING_BY_HUMAN → PREVIEWS_SENT → PAYMENT_INTERESTED → PAYMENT_CLAIMED → PAYMENT_VERIFIED → MATCHED → COMPLETED`

Rules beyond the arrows:
- `PENDING → SEARCHING_BY_*` allowed (requirements already complete at creation).
- `SEARCHING_BY_HUMAN` requires `taken_over_by`; `SEARCHING_BY_HUMAN → SEARCHING_BY_AI` requires a reason. Every change writes a history row, so handovers are on the timeline.
- `PREVIEWS_SENT → SEARCHING_BY_*` allowed (more searching). `PAYMENT_VERIFIED → SEARCHING_BY_*` and `→ PREVIEWS_SENT` allowed.
- `PAYMENT_CLAIMED` is set **only** by recording a claim; `PAYMENT_VERIFIED` **only** by the verify action when verified claims cover the charge; `PAYMENT_FAILED` by rejecting the last open claim. The generic status endpoint refuses these targets.
- `MATCHED` requires full verified payment.
- Side paths: `SELF_SERVICE`, `CANCELLED` (from any non-terminal state), `PAYMENT_ISSUE` ⇄ payment states, `PAYMENT_FAILED → PAYMENT_INTERESTED`, `REFUND_REQUESTED` (only after a verified payment) `→ REFUNDED`.
- Terminal: COMPLETED, REFUNDED, CANCELLED, SELF_SERVICE (CANCELLED/SELF_SERVICE can reopen to PENDING with a reason, admin only).
- Agent keys cannot set REFUNDED or reopen terminal orders (`agent_allowed = false`).
- Illegal moves raise `ORDER_INVALID_TRANSITION` → API 422 `INVALID_TRANSITION`.

## 3. Backend functions (single write path)

Core functions `co_*` (`SECURITY DEFINER`, `search_path = public`, execute granted to `service_role` only), each taking an actor `(type, id, label)` and writing history/activity:
`co_create_order`, `co_update_order`, `co_set_status`, `co_record_payment_claim`, `co_review_payment_claim`, `co_add_note`, `co_add_match`, `co_update_match` (owner permission, verification), `co_assign`, `co_soft_delete`, `co_rate_limit_hit`.

Admin wrappers `admin_customer_order_*` (granted to `authenticated`): `assert_admin_permission('orders.manage')` — or `'payments.review'` for review-claim and soft delete — then call the core function with the admin as actor and `log_admin_action(...)`, returning `{ row, audit_id }` like `admin_set_order_status`.

Server-side rules inside the core functions:
- Charge from a constant in SQL (`HOUSE_SEARCH = 500`); never a parameter of the API path.
- Claim requires `amount_bdt > 0` and `trx_id` or `sender_last4`; multiple claims accumulate; overpayment accepted and flagged.
- Duplicate guard: an active order with the same phone and same normalised area raises `ORDER_DUPLICATE` unless `confirm_duplicate = true`.
- Idempotency: same `(key label, idempotency_key)` returns the original order.

## 4. REST API — Edge Function `supabase/functions/customer-orders/`

Routes (under `/api/v1`): `POST /orders`, `GET /orders`, `GET /orders/by-customer`, `GET /orders/{order_no}`, `PATCH /orders/{order_no}`, `POST …/status`, `POST …/payment-claim`, `POST …/payment-verify` (admin scope), `POST …/notes`, `POST …/matches`, `GET …/timeline`, `DELETE /orders/{order_no}` (admin scope, soft delete).

Files:
- `index.ts` — Deno entry: CORS, auth, rate limit, dispatch, service-role client via `createAdminClient()` from `_shared/paymently.ts`.
- `router.ts`, `validation.ts`, `serialize.ts`, `scopes.ts`, `errors.ts` — **pure TS, no Deno imports**, so `npm test` can import them (same trick as `tests/listingQuality.test.mjs`).
- `_shared/apiKeys.ts` — labelled-key parsing and constant-time compare, copied from the `agent-listings` pattern (`getAgentKeys`, `authenticate`); `agent-listings` itself is not changed.

Behaviour:
- Auth: `Authorization: Bearer`; key label → scope `agent` or `admin`. Agent calling verify/delete → 403 `FORBIDDEN`.
- Envelope `{ success, data, meta? }` / `{ success:false, error:{ code, message, details? } }`; codes per spec §2.6. SQL error prefixes map to codes.
- `created_via`: agent key → `ai_agent`; admin key → `human_agent`.
- List filters from spec §2.2 run against `customer_orders_enriched` (incl. `payment_status`, `has_listings`, `listings_found_min`, budget overlap, repeatable `status`), plus `created_via`. `page` / `per_page` (max 100) with `meta.total`.
- `type` may be omitted or `HOUSE_SEARCH`; `PAID_AD` → `VALIDATION_ERROR`.
- `assigned_to` accepts an admin user uuid or email (the spec's name slug has no backing field).
- Unknown or forbidden body fields (`service_charge_bdt`, `amount_paid`, `payment_status`, any bKash number field) → `VALIDATION_ERROR`. Phone regex reused from `agent-listings/validation.ts`.
- `serialize.ts` removes `owner_contact_phone` and `exact_address` from matches unless `contact_unlocked` and that match has `owner_permission`. Applied to every response, both scopes via API.
- Rate limit 120 requests/minute per key label → 429 `RATE_LIMITED`.
- Every write passes the key label as actor.

Deploy plumbing:
- `scripts/deploy/edge-functions.sh`: add the two env vars to the compose override template, generate missing keys into `/root/agent-api-keys.txt`, add smoke checks (401 without key, 403 agent on verify).
- `scripts/deploy/nginx-newtolet.conf`: `location /api/v1/ { proxy_pass http://127.0.0.1:8000/functions/v1/customer-orders/; proxy_http_version 1.1; proxy_set_header Connection ""; no caching; include security headers }`. Agents must use `www.newtolet.com` (the apex 301 drops POST bodies).

## 5. Admin UI (English only, existing components)

New:
- `src/lib/customerOrderStatus.js` — statuses, labels, transition mirror, payment/listing display helpers (pure, tested).
- `src/services/admin/customerOrders.js` — list via `runAdminListQuery` on `customer_orders_enriched`; mutations via `callAdminRpc`; `invalidateAdminSnapshots('customer-orders')`.
- `src/components/admin-panel/sections/AdminCustomerOrdersSection.jsx` and `src/components/admin-panel/customer-orders/` (`OrderDetailView`, `OrderFormDialog`, `StatusChangeDialog`, `PaymentPanel`, `MatchesPanel`, `OrderTimeline`).

Edited:
- `adminPanelConfig.js` (nav item `customer-orders`, `badgeKey: 'customerOrdersAttention'`), `AdminPanelApp.jsx` (switch case), `src/services/admin/dashboard.js` (counts), `AdminDashboardSection.jsx` (counter cards), `src/lib/adminStatusMeta.js` (pill tones), `src/services/admin/auditLog.js` (entity/action names).

Screens:
- **List**: `DataTable` + `FilterBar` + `Pagination` with `useAdminList` and URL state (`adminListUrlState.js`). Search phone/name/order no. Filters: status, **created by**, assignee (incl. "Assigned to me"), date range, payment status, listings found. Columns: order no, customer, created by, status (with AI/Human search marker), listings `5 (2 verified)`, payment `300 paid, 200 due` / `Paid ✓`, assignee, created.
- **Detail** (`?tab=customer-orders&id=`): header with listings total/verified/unverified, all fields, Facebook thread link, payment panel, matches list, notes, day-grouped timeline (pattern from `AdminCustomersSection.jsx`).
- **Create / edit** `FormDialog`; duplicate warning with "Create anyway".
- **Status change** `ReasonDialog` (reason required; SEARCHING_BY_HUMAN asks who took over); options from the transition mirror.
- **Payment panel**: charge / paid / due / overpaid flag, claims list, Record payment form (amount required), Verify / Reject per claim inside `PermissionGate` for `payments.review`.
- **Counters**: open orders, claims awaiting verification, inside 7-day refund window, overdue follow-ups, 0 listings found. Sidebar badge = claims awaiting verification + overdue follow-ups.

## 6. Phases and checks

Branch `feature/customer-orders` from the current HEAD. Commit per phase. Nothing is deployed until you confirm.

0. **Docs** — copy this plan to `docs/customer-order-plan.md`.
1. **Database** — migration, rollback script, `seed-customer-orders.sql` / `unseed-customer-orders.sql` (3 `TEST` orders: paid+verified searching-by-human, PAYMENT_INTERESTED, and a PARTIAL_PAID order in PAYMENT_CLAIMED). Check: apply twice on the staging clone (`test-migration-on-staging.sh`, checks edited), rollback runs clean, closing assertions pass.
2. **Status machine + payments in SQL** — new T11 block in `rls-tests.sql` and `run-rls-tests.sh --dry-run-customer-orders`: legal/illegal transitions, AI ⇄ human handover, claim never verifies, partial maths, verified partial keeps contact locked, append-only tables, agent actor cannot review or refund, idempotent create, mirror trigger.
3. **API** — Edge Function + `docs/customer-order-api.md` (layout of `AI_LISTINGS_API.md`, curl for every endpoint) + `docs/customer-order-agent-prompt.md` (Prompt 3 corrected: `PENDING` not `NEW`, `SEARCHING_BY_AI` not `SEARCHING`, www base URL, PAID_AD order step removed — owners are only told listing is free). Check: `npx -y deno@2 check --node-modules-dir=none supabase/functions/customer-orders/index.ts`; Node tests for router, validation, scopes, masking.
4. **Admin UI** — section, panels, counters, badge. Check: `npm run lint`, `npm test`, headless browser pass with fixture-mocked REST/RPC (playwright-core pattern), one browser process at a time.
5. **Tests + report** — `tests/customerOrderStatus.test.mjs`, `tests/customerOrderApi.test.mjs`; full `npm test`, lint, `npm run build`; pass/fail report per checklist item.
6. **Deploy (separate confirmation, you run the `!` steps)** — staging test → dry run → apply migration → deploy function + keys → nginx reload → site release → smoke test with the seeded orders, then unseed.

## 7. Verification end to end

- SQL: `run-rls-tests.sh HOST --dry-run-customer-orders` prints `RLS_TESTS_PASSED` (rolled back, no live change).
- API after deploy: create with `Idempotency-Key` twice → same `order_no`; `PENDING → PAYMENT_VERIFIED` via status → 422; claim 200 then 300 → PARTIAL_PAID then PAID, status PAYMENT_CLAIMED; agent key on verify → 403; admin key verify → PAYMENT_VERIFIED; match owner phone absent before, present after verification + owner permission.
- Dashboard: seeded orders visible, Created by filter splits the mirrored website orders from the seeds, verify buttons hidden for a support-role account.

## 8. Out of scope (v1)

PAID_AD (50 BDT promotion) orders, payment gateway, automatic refunds, field-agent app, auto-matching engine, in-dashboard Messenger chat, customer tracking page or login, SMS/email notifications, invoices, websockets, bulk import of Messenger history, any change to the public website (order form, listing, search), the old `orders` table/tab/job feed, and `agent-listings`.

## 9. Open points to be aware of

- The website form still tells customers 1000 BDT and still shows the fake payment step; mirrored orders therefore carry a 1000 BDT charge. Fixing the form is a separate front-end task.
- No local database exists, so all SQL is proven only by VPS dry runs and the staging clone, which you run with `!`.
- Whether migrations 20261101–20261114 are all applied live could not be confirmed from the repo; phase 1 starts with a fresh `dump-schema.sh` snapshot to check.

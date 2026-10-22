# Name TBD — Build Plan

## Recommended stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript end to end | One language for the storefront, admin, API and design tool |
| Web app | Next.js (App Router) | Server-rendered storefront for SEO, plus admin and API in one deployable |
| Database | PostgreSQL + Prisma | Relational data (orders, pricing tables, commissions); migrations |
| Background jobs | pg-boss (on Postgres) | Automations, catalog sync, mockup rendering, emails; no extra Redis |
| Design tool | Fabric.js canvas, JSON design document | Mature canvas library; the same document drives mockups and print files |
| Rendering | Server-side node-canvas / sharp | Mockups and print-ready PNG/PDF from the design document |
| File storage | S3-compatible (AWS S3 or Cloudflare R2) | Artwork, mockups, proofs |
| Payments | Stripe (your own account) | Cards, wallets, BNPL, deposits; Connect later for payouts |
| Shipping | EasyPost or Shippo | Rates, labels, tracking across UPS/FedEx/USPS |
| Email/SMS | Postmark or Resend + Twilio | Transactional email, approval links, tracking SMS |
| Auth | Auth.js (email magic link + password) | Customer accounts, staff roles, store-owner logins |
| Hosting | Vercel + Neon/Supabase Postgres, or a single VPS with Docker | Your choice; both work |

## Phases

Each phase ends with something usable. Reordered 2026-10-22: back-office
orders come before the public storefront.

1. ✅ **Foundation + catalog + pricing engine.** Schema, staff sign-in and
   roles, catalog, decoration methods and price tables, markup, discounts,
   taxes, price check.
2. ✅ **Customers, quotes and orders.** Customers and companies, quotes and
   orders built from catalog products and decorations with live pricing,
   reusable designs, editable order statuses, staff assignment, activity
   timeline and notes, quote-to-order conversion.
2b. ✅ **Multi-business platform.** Every record belongs to a business,
   enforced by a business-scoped database client and composite foreign keys;
   businesses resolved from the request's host; per-business staff sign-in;
   platform admin to add, configure and suspend businesses. Platform billing
   comes later.
3. ✅ **Approvals, artwork, payments.** Customer quote approval links, artwork
   proofs with approve/request-changes, artwork file storage, recorded
   payments and deposits, invoices and emails.
4. ✅ **Production, purchasing, shipping.** Workflow steps per method,
   production calendar, consolidated supplier POs and receiving, shipping
   (ShipStation) and business-wide delivery methods, packing slips,
   tracking notifications.
5. **Storefront engine + checkout.** One storefront engine for the root
   storefront and every affiliate store, CMS pages, catalog browsing, cart,
   Stripe checkout, shopper accounts or guest checkout, promo and gift codes.
6. **Affiliate stores.** Stores dashboard (consolidated columns, live
   request flags, grouping, views, bulk actions) and per-store dashboards;
   create stores manually or **publish a quote/order to a new or existing
   store (update or overwrite)**; staff mockup tool for store item images;
   item pricing with overrides and markups; name/number personalization;
   settings inherited business → group → store; open/close dates and
   batched production; store owner portal (selectable sections, contacts,
   code usage, requests → optional draft quote / Slack); commissions;
   drag-and-drop store showcase widgets (filters, sorting, layouts) on the
   root storefront and affiliate stores.
7. **CRM depth.** Leads, follow-up tasks, pipeline, Mailchimp sync.
8. **Automations + integrations.** Rules engine, QuickBooks Online, Slack,
   supplier live catalogs and ordering, public API.
9. **Customer designer.** Online design tool for shoppers where a store
   enables it, within root store and store manager permissions.
10. **Cutover.** URL redirects from the old beezetees.com paths, DNS switch
    (including wildcard DNS for store subdomains). No data import.

Supplier catalog connectors (SanMar and S&S first, then Charles River and
Pennant) start alongside phase 1 once you have API credentials, because
phases 1–3 need real product data.

## Progress

- **Phase 1 (done):** schema, pricing engine, staff sign-in with roles, and
  admin screens for products, categories, suppliers, decoration methods and
  price tables, markup and quantity discounts, shop settings and tax, staff,
  and a price check tool. Still to do before launch: real decoration prices
  (entered in admin), supplier catalog connections (waiting on SanMar/S&S
  API credentials), and rate limiting on staff sign-in.
- **Phase 2 (done):** customers and companies with addresses, pricing group
  and tax-exempt settings; quotes and orders with items built from catalog
  products and decorations, live repricing, editable statuses, assignment,
  activity timeline and notes; quote-to-order conversion (blocked while
  items have pricing problems); "assigned to me" on the dashboard. Lines
  point at reusable designs, ready for publishing to stores in phase 7.
- **Multi-business (done):** Name TBD now hosts many businesses. Existing
  data moved into Beeze Tees. Platform admin at `/platform`.
- **Phase 3 (done):** customer links for quotes and orders (no login):
  approve or ask for changes; order files; artwork proofs with
  approve/request-changes and customer attachments; statuses that move
  automatically on customer responses ("Set automatically" in Order
  statuses); deposits, payments and refunds; invoice numbers and invoices on
  the customer link; email via Resend or Postmark with every message listed
  on the order. Deferred: online card payments (phase 5 checkout), file
  storage on S3/R2, QuickBooks invoice sync (phase 8).
- **Phase 4 (done):** production jobs per order and decoration method with
  editable workflow steps, a production board and a weekly drag-and-drop
  calendar with daily capacity and auto-scheduling, printable work orders;
  blanks needed by open orders, consolidated purchase orders per supplier
  (emailed or marked sent, printable, partial receiving), in-house stock with
  low-stock levels and history, customer-supplied blanks; business-wide
  delivery methods, partial shipments and pickups with tracking emails, a
  shipping list with batch packing slips, delivery shown to the customer;
  statuses that move forward automatically. Deferred: ShipStation and
  supplier API ordering (phase 8), carrier rates and labels (through
  ShipStation), batching store orders into one run (phase 6).

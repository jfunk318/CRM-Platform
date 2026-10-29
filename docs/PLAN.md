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
5. ✅ **Storefront engine + checkout.** One storefront engine for the root
   storefront and every affiliate store, CMS pages, catalog browsing, cart,
   Stripe checkout, shopper accounts or guest checkout, promo and gift codes.
6. ✅ **Affiliate stores.** Stores dashboard (consolidated columns, live
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
10. **Cutover.** URL redirects from the old companyname.com paths, DNS switch
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
  data moved into Company Name. Platform admin at `/platform`.
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
- **Phase 5 (done):** one storefront engine (root store now, affiliate
  stores next) with branding, Markdown content pages and menus, shop items
  priced per size (base from pricing at a batch quantity, override, item or
  store markup), catalog browsing with quote requests (land as draft
  quotes), search, order tracking, cart with promo and gift codes, checkout
  with delivery methods and tax, Stripe Checkout on each business's own
  account (encrypted keys, signed webhooks; test payment page in
  development), pay later option, online payment of deposits and balances
  from the customer link, shopper accounts with emailed sign-in links and
  optional passwords, account modes, access codes, show/hide prices,
  settings inherited from business defaults, GA4 / Meta Pixel, sitemap,
  robots and product structured data. Online orders keep store prices, record
  payments and create production jobs. Deferred: store groups and affiliate
  subdomains (phase 6), name/number personalization (phase 6), ShipStation
  rates (phase 8), the customer designer (phase 9).
- **Phase 6 (done):** the storefront built in phase 5 became the
  first affiliate store (Affiliate Store 1 at store1.<domain>) and every
  business got a fresh main site. Built: store subdomains (platform
  and custom domains), a role-based back-office switcher (Store manager
  role), the stores dashboard (search, group/status/manager filters, newest /
  highest sales / closing soon views), per-store dashboards (overview,
  items, pages, codes, settings), store groups with inherited settings and
  markups, open/close dates, main site managed like a store with
  `[[stores]]` showcase blocks, global promo and gift codes limited to all or
  chosen stores, publishing a quote/order to a new or existing store
  (update or overwrite), mockups as store item pictures, name/number
  personalization (store items and staff rosters), batching orders into one
  production order at store close, commissions with payouts, the store
  owner portal (sections, contacts, code usage, commission, requests with
  live flags, draft quotes and Slack), visit counts, and a drag-and-drop
  page builder with store showcase (filters, sorting, layouts) and item
  blocks. Deferred: a scheduler for the store-batch cron endpoint is the
  host's job (see Production notes in the README).
- **Supplier catalog file import (done):** SanMar's product data download
  (SanMar_SDL_N) imports from Suppliers, choosing brands, categories,
  discontinued styles and which price is the cost; it runs in the background,
  repeats without duplicating, and keeps staff edits. Products with thousands
  of styles are handled with a type-to-search product picker (order lines,
  store items, price check) and a paged, searchable storefront catalog.
  Still to do: S&S Activewear's file format, and live API connections once
  SanMar/S&S credentials are available (phase 8).
- **Store themes (done):** five storefront themes (minimal, team/sports,
  dark, luxury, local/rustic) with per-store accent, logo and homepage
  banner (image, headline, text, button; built-in art in the store's colors
  when there's no image, two per theme, any of which a store can pick), applied to every storefront page, picked on a store's Look tab or
  when publishing a quote to a new store. More themes can be added in
  `src/lib/store/themes.ts`.
- **Phase 7 (in progress):** leads (contact and opportunity details,
  sources, owners, statuses with lost reasons, a contact timeline, duplicate
  warnings, converting into a customer and company with a draft quote, and
  website quote requests from newcomers becoming leads); follow-up tasks
  (due dates, assignees, linked to leads, customers, quotes and orders, a
  Tasks page, menu count and dashboard list, automatic follow-ups for
  unanswered quotes); the pipeline board (leads and quotes from new to
  won/lost, values per stage, win rate, drag leads between stages). Still
  to do: Mailchimp sync.
- **Phase 8 (in progress):** the rules engine (triggers for quotes, orders,
  status changes, payments, proofs, leads and store requests; conditions;
  email, task, assign, status, Slack and note actions with placeholders;
  recipes; a run log; loop protection). Still to do: QuickBooks Online,
  more Slack, supplier live catalogs and ordering, the public API.
- **Bulk design and live pricing (done):** the same decoration on many
  products at once (placed and sized per product by placement guides, same
  size or scaled to fit, per-item fine-tuning), bulk updates to chosen items
  (replace, or adjust the existing decoration), stitch estimates from the
  artwork's size and coverage, and live prices while designing (DTF by size,
  embroidery by stitches, screen print by colors and locations).
- **Design studio (done):** artwork placed on quote/order items and store
  items: upload (PNG/JPG/GIF/WebP/SVG), drag and size within the print
  area on the product photo, DPI check against each method, background
  removal, trim, color swaps, one color, invert, detected ink colors and
  placed size feeding pricing; mockups on staff pages and the customer link;
  proofs rendered from mockups; "Enhance for print" brings low-resolution
  art to 300 DPI by tracing flat art to vector or a labelled smooth
  enlargement. Still to do: AI upscaling of photos and photo background
  removal with an AI model (paid service or self-hosted), PDF/AI/EPS placement, text and
  names/numbers (phase 6 personalization), mockups on store item cards, and
  the customer-facing designer (phase 9) on the same engine.

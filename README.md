# Name TBD

Working name for a print-shop business platform: storefront, online design
tool, quotes, orders, production, CRM and affiliate stores. Many print shops
run their business **through** the platform; Company Name is the first.

| Level | Example | Where it lives |
|-------|---------|----------------|
| Platform | Name TBD | `PLATFORM_DOMAIN` (e.g. `nametbd.com`); admin at `/platform` |
| Business | Company Name | its own domain (`companyname.com`) or `<slug>.<PLATFORM_DOMAIN>`; back office at `/admin` |
| Affiliate store | Lincoln Hockey | `<store>.<business domain>` (phase 7) |

- [Feature spec](docs/SPEC.md)
- [Build plan](docs/PLAN.md)

## Development

Requires Node.js 22 and PostgreSQL 16.

```bash
npm install
cp .env.example .env        # fill in the SEED_* logins
docker compose up -d        # or point DATABASE_URL at your own Postgres
npm run db:migrate          # create tables
npm run db:seed             # platform admin + Company Name with starter data (safe to re-run)
npm test                    # unit tests + database tests (need DATABASE_URL)
npm run dev
```

Then:

- **Platform admin:** http://localhost:3000/platform (the `SEED_PLATFORM_ADMIN_*` login)
- **Company Name back office:** http://companyname.localhost:3000/admin (the `SEED_ADMIN_*` login)
- Other businesses you add: `http://<slug>.localhost:3000/admin`

`*.localhost` addresses work in Chrome, Edge and Firefox. While there is only
one business, plain http://localhost:3000/admin opens it too (or set
`DEV_BUSINESS_SLUG`).

## How businesses are kept apart

Every business table has a `businessId`, and:

1. **App:** pages and actions get a database client from `requireStaff()`
   that filters every query, and stamps every new record, with the signed-in
   staff member's business (`forBusiness()` in `src/lib/db.ts`).
2. **Database:** links between records include `businessId` (composite
   foreign keys), so Postgres rejects connecting one business's records to
   another's.
3. **Sessions:** a staff session only counts on its own business's address.

`src/lib/isolation.db.test.ts` checks all three.

## Customer links, proofs and payments

- **Quotes:** "Email quote" on a quote sends the customer a private link
  (`/c/<token>`, no login) where they approve it (name + checkbox) or ask for
  changes. Converting the quote gives the order its own link.
- **Artwork:** upload files on the order, then create a proof. The customer
  approves it or asks for changes at `/proof/<token>`, and can attach files.
  Sending a new proof retires the older ones.
- **Statuses:** in Order statuses, "Set automatically" picks the status a
  quote or order moves to when it's emailed, approved, or changes are asked for.
- **Payments:** set a deposit, record payments and refunds (refunds need the
  Refunds role), then issue an invoice. The customer link shows it with the
  balance and your payment instructions (Shop & tax). Online card payments
  come with checkout in phase 5.
- **Email:** set `EMAIL_FROM` plus `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`.
  Without them nothing is sent, but every email is still listed on the order
  and links can be copied from there.
- **Files** are stored under `STORAGE_DIR` (default `./storage`), never in
  the web root; they're only served to signed-in staff of the business, or
  to the customer through a proof link on the business's own address.

## Production, purchasing and shipping

- **Production:** each order gets a job per decoration method, with steps to
  tick off (set per method under Decoration methods, along with daily
  capacity). Jobs are created when the customer approves a proof, or from the
  order page. The Production board and the weekly calendar (drag jobs between
  days, or Auto-schedule) show what's up next; each order has a printable
  work order.
- **Purchasing:** the Purchasing page lists blanks open orders still need.
  Ordering uses in-house stock first, then adds to each supplier's draft PO,
  so several orders go out on one PO. Send (email) or mark sent, then receive
  in parts; extras go into stock. Blanks can also be marked as supplied by
  the customer. Inventory tracks stock with low-stock levels.
- **Shipping:** delivery methods are one business-wide list (Delivery
  methods), chosen on each order, which fills in its charge. Record
  shipments, pickups or local deliveries, in parts if needed, with tracking
  links emailed to the customer and shown on their order page. The Shipping
  page lists orders ready to go and prints packing slips together.
- **Statuses:** orders move to "Ordering blanks", "In production", "Ready
  for pickup / shipping" and "Completed" on their own, and only forward
  (Order statuses → Set automatically).

## Main site, affiliate stores and checkout

- **Two areas in the back office.** "Business" is the CRM, orders,
  production, purchasing and shipping. "Affiliate stores" is where stores
  are run. The switcher at the top only appears for staff with the **Store
  manager** role (and admins).
- **Affiliate stores** are stores the business runs for its customers, each
  at its own subdomain: `store1.companyname.com` (in development
  `http://store1.companyname.localhost:3000`). Affiliate stores → All stores
  lists them with search, filters (group, status, manager) and views
  (newest, highest sales, closing soon). Each store has a dashboard:
  Overview (sales, latest orders), Items, Pages, Codes and Settings
  (address, customer, manager, group, open/close dates, branding, accounts,
  prices, pay later, access code, markup, delivery methods, showcase).
- **Store groups** (Schools, Teams…) carry settings their stores inherit:
  business defaults → group → store.
- **The main site** (the business's own address) is managed the same way
  under Affiliate stores → Main site. It sells the business's own items,
  offers the blank catalog and quote requests, and shows the stores: put a
  line like `[[stores]]` or `[[stores group="Schools" sort=sales limit=6
  columns=3]]` on any page.
- **Items** are priced per size from your pricing as a batch (base), with
  overrides and item, store or group markups.
- **Promo and gift codes** are one list for all stores (Affiliate stores →
  Promo codes / Gift codes); each works in every store or only chosen ones,
  and each store's Codes tab shows what it accepts and how they were used.
- **Checkout**: cart, codes, delivery methods, tax, Stripe on the business's
  own account (Affiliate stores → Defaults & payments; keys encrypted with
  `APP_SECRET`), optional pay later, a test payment page in development.
  Orders from every store land in Orders tagged "Online" with the store's
  name; quote requests from the main site land in Quotes as "Web request".
- **Shopper accounts** sign in with an emailed one-time link and can set a
  password. Accounts, carts and sign-ins are per store address.
- The back office only opens on the business's own address, never on a
  store subdomain.

## Supplier catalogs

Suppliers → **Import a supplier catalog file** loads SanMar's product data
download (SanMar_SDL_N, as the zip or the CSV inside it, up to 50 MB). After
the file is read you choose brands, categories, whether to include
discontinued styles, and which SanMar price is your cost (piece, dozen or
case), then the import runs in the background with progress on the page.

- New styles become products with colors (swatch color and white/light/dark
  guessed from the name), sizes, SKUs with costs and SanMar's order code,
  SanMar's photos per color, the decoration spec sheet, categories, and
  starter print areas (shirts, caps and bags each get their own).
- Importing again (a newer file, or more brands) updates costs, adds new
  colors and sizes and flags discontinued ones. It keeps your edits to
  names, descriptions and categories, and never duplicates. A product you
  entered by hand with the same style code is adopted, not duplicated.
- The file is read in a worker thread (`src/lib/catalog/import/read-worker.mjs`,
  started by path from the app folder) so the site stays responsive.
- Supplier files hold your account pricing: don't commit them to the repo.

## Production notes

- Set `PLATFORM_DOMAIN`. `localhost` shortcuts are off in production.
- Point `PLATFORM_DOMAIN`, `*.PLATFORM_DOMAIN` and each business's custom
  domain (plus `*.customdomain` for its affiliate stores) at the app, with
  TLS for each (wildcard certificates for the store subdomains).
- Run behind a proxy that sets `X-Forwarded-Host` and `X-Forwarded-Proto`
  (customer links in emails are built from them).
- Set `APP_SECRET` before saving any Stripe keys.
- `STORAGE_DIR` must be on persistent disk, and backed up, until file storage
  moves to S3/R2. Allow 55 MB request bodies at the proxy for uploads.

## Layout

| Path | What |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts`, `seed-data.ts` | Development setup: platform admin, Company Name and its starter data |
| `src/lib/db.ts` | Database clients: unscoped `prisma` and business-scoped `forBusiness()` |
| `src/lib/business.ts`, `hosts.ts` | Which business a request is for, from its host name |
| `src/lib/platform/` | Platform name and the defaults every new business starts with |
| `src/lib/pricing/` | Pricing engine (pure functions) and `load.ts`, which builds engine input from the database |
| `src/lib/auth/` | Passwords, staff and platform sessions, roles |
| `src/lib/orders/` | Quotes and orders: numbering, line/design editing, conversion, repricing, customer links and proofs (`customer-flow.ts`), payments and invoices |
| `src/lib/production/` | Production jobs, workflow steps, scheduling |
| `src/lib/purchasing/` | Blank needs, purchase orders, receiving, stock |
| `src/lib/shipping/` | Shipments, pickups, tracking links, delivery methods |
| `src/app/admin/(print)/` | Printable work orders, packing slips and purchase orders |
| `src/lib/files/` | Upload checks, file storage, order files |
| `src/lib/email/` | Email templates and sending (Resend or Postmark) |
| `src/app/c/`, `src/app/proof/` | Customer pages: quote/order/invoice and proof review |
| `src/lib/catalog/import/` | Supplier catalog import (SanMar file reader, background import) |
| `src/lib/store/` | Storefront engine: stores and inherited settings, items and prices, cart, checkout, accounts, quote requests, showcase |
| `src/lib/payments/` | Stripe (hosted Checkout and signed webhooks) |
| `src/app/(store)/` | The public storefront |
| `src/app/admin/` | A business's back office: `(panel)` business admin, `(stores)` affiliate stores |
| `src/app/platform/` | Platform admin: businesses |

## Importing data later

Records that could come from another system (products, variants, categories,
decoration methods, pricing groups, customers, orders) carry
`externalSource` + `externalId`, unique per business. An importer upserts on
that pair, so importing is repeatable and never duplicates rows.

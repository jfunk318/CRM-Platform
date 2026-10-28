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

## Leads

Business → Leads (Sales role) holds people who might buy but haven't yet.

- **Add a lead** with their name, organization, title, email, phone, source
  (suggestions like Phone, Referral, Trade show, or anything typed), what
  they're after, an estimated value and an owner. Someone already on file
  with the same email or phone (a customer or an open lead) is flagged
  before they're added twice.
- **Statuses:** New → Contacted → Qualified → Converted, or Lost (with a
  reason). Logging a call, email or meeting on a new lead moves it to
  Contacted. Every contact, note, status and owner change is on the lead's
  timeline.
- **The list** shows open leads by default (or one status, or all), filtered
  by owner (mine, nobody's, anyone's) and searchable, with the open leads'
  total estimated value.
- **Convert** makes the customer (or matches the one with the same email),
  makes or matches their organization as a company, and can start a draft
  quote. The customer page links back to the lead.
- **Website quote requests** from people who have never ordered also become
  New leads (source "Website quote request"), linked to their customer and
  quote (`src/lib/crm/leads.ts`).

## Pipeline

Business → Pipeline shows every open opportunity, leads and quotes
together, in columns: **New lead**, **Contacted** (including qualified),
**Quoting** (draft quotes), **Quote sent** (sent or changes requested),
**Won** (approved or converted to an order) and **Lost** (lost leads,
declined quotes). A lead that has a quote shows as its quote, so nothing
appears twice; quotes for existing customers are on the board too.

- Each column shows its count and value (estimated value for leads, the
  quote total for quotes); cards show who, value, owner and how long
  they've been in that column.
- The header shows open count and value, and won, lost and the win rate
  over the last 30 days, 90 days or a year. Show everyone's, mine, or one
  person's (a lead's owner, a quote's assignee).
- Drag a lead between New, Contacted and Lost (Lost asks why). Quotes move
  with their status: send, approve, convert or decline the quote
  (`src/lib/crm/pipeline.ts`).

## Automations

Business → Automations (admins): rules that do things when something
happens. Each rule has a trigger, optional conditions and a list of
actions run in order.

- **Triggers:** a quote or order is created, a store order is placed, a
  quote or order changes status (by staff, the customer or another rule),
  an order is paid in full, the customer approves a proof or asks for
  changes, a lead comes in, a store owner sends a request.
- **Conditions:** the new status (any of several), quotes or orders,
  from a given store or not from a store, rush only, total at least an
  amount; for leads, the source contains some text. Only the conditions
  that fit the trigger are offered.
- **Actions:** email the customer (with a button to their quote or order),
  email staff (the assignee or lead owner, the business email, or a
  person), create a task due in N days, assign, set the status, post to
  Slack, add a note to the timeline. Messages take placeholders such as
  `{{customer.firstName}}`, `{{order.ref}}`, `{{order.total}}` and
  `{{order.link}}`; click one to add it to the field.
- Five recipes to start from (thank customers when they pay, call new
  leads, tell the assignee about approved proofs, post store orders to
  Slack, answer store owners' requests).
- The change and its event are saved together; rules run right after the
  request (the hourly job catches anything left). Every rule that ran is
  logged with what it did or why it failed, on the list and the rule's
  page; one failing rule doesn't stop the others. Rules that set off other
  rules stop after three steps, so two rules can't loop forever
  (`src/lib/automation/`).

## Tasks

Follow-ups for staff (Business → Tasks): what to do, a due date (with
Today / Tomorrow / In 3 days / Next week shortcuts), who it's for, and
optionally the lead, customer, quote or order it's about.

- **Tasks** lists mine, everyone's or unassigned tasks as Overdue, Today,
  Coming up and No due date, with recently done ones below. Tick one to
  mark it done.
- Leads, customers, quotes and orders each have a **Tasks** card with their
  open tasks and a form to add one; tasks on a lead also go on its
  timeline.
- The menu shows how many of my tasks are due today or overdue, and the
  Dashboard lists them.
- **Quote follow-ups:** when a quote was emailed some days ago (Shop & tax →
  "Follow up on unanswered quotes after", 5 by default, blank = off) and
  is still waiting for an answer, a "Follow up on quote …" task is made
  for whoever has it, once per sending (runs with the hourly schedule; see
  Production notes) (`src/lib/crm/tasks.ts`).

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

## Placing artwork (design studio)

On a quote or order item (or a store item), **+ Add decoration** opens the
designer, where the whole decoration is set up: method, location (a print
area, picked from the list, the view thumbnails or the area chips, or an
"Other location" typed in), ink/thread colors, stitches, digitizing and
screen options, and the artwork. A decoration can be saved without artwork
(it's marked "needs artwork", with its size typed in). On the item each
decoration is a one-line summary with Edit and Remove. The designer shows
the product photo in the item's color with the print area outlined, next to
the customer's artwork:

- **Artwork library:** each customer has saved artwork (Customers → a
  customer → Artwork), shared with everyone at their company. Images uploaded
  to their orders, sent with their quote requests or proof responses, or
  uploaded in the studio are added automatically (each image once, by
  content). The studio opens on this gallery, most recently used first; pick
  one, or **Upload new artwork** (PNG, JPG, GIF, WebP or SVG; PDF/AI/EPS can
  still go in the order's files). Store items use the store owner's library.
- Drag to move it, drag the corner to resize, or type a width; it stays
  inside the print area. Thumbnails of every product view sit under the
  photo (with the item's other artwork on them): click one to move the
  artwork to that view; chips switch between print areas on the same view.
- **Garment colors:** swatches under the photo preview the artwork on any
  of the product's colors; "Use … for this item" changes the item's color.
  Swatch colors come from the color name (`colorHex` in the SanMar
  importer); unknown names show striped and re-importing fills them in.
- Removing a file from an order's Files also takes it out of the customer's
  artwork library (unless another order still lists it).
- **Resolution check:** DPI at the placed size against the method's minimum
  and ideal (Decoration methods), with a warning when it's too low.
- **Enhance for print:** below 300 DPI, "✨ Enhance for print" compares a
  close-up before and after and offers two fixes, recommending one:
  - *Trace to vector* (flat-color art such as logos and text): the art is
    traced with its own colors (imagetracerjs), then drawn at 300 DPI for the
    placed width. The SVG is attached to the order as a Production file
    ("Traced to vector for print").
  - *Enlarge smoothly* (photos and gradients): a high-quality resize to
    300 DPI. It's labelled "enlarged from N DPI" everywhere, since it can't
    add detail.

  The item row, the order page and the work order say which was used
  (`src/lib/design/enhance.ts`). AI upscaling of photos isn't built yet.
- **Clean-up:** remove a solid background (from the edges, or that color
  everywhere), trim empty edges, swap any detected color, print in one
  color, invert. Colors are consolidated to at most 8 (closest shades
  merge); "Limit to N colors" flattens the art to N solid inks. Edits run in the browser (`src/lib/design/raster.ts`); the
  original upload is kept, so edits can be changed later.
- **Pricing:** the placed width and height fill in, and for screen printing
  the detected ink colors.
- **Mockups** (photo + artwork) show on the item, on the customer's quote or
  order link, and when creating a proof you can tick "Include mockups" to
  have them rendered into proof images (`src/lib/design/mockups.ts`, sharp).

Where a print area sits on each product photo is set under the product's
Views & Decoration Areas; adjust it there if mockups sit too high or low.
Customers only see artwork through their own link (`/c/<token>/art/…`).

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
  offers the blank catalog and quote requests, and shows the stores.
- **Look** (store → Look): every store (and the main site) has a theme:
  **Minimal** (clean white, modern sans-serif, split banner), **Team /
  sports** (bold condensed capitals, a header and striped banner in the
  team color), **Dark** (near-black with a glowing accent), **Luxury**
  (ivory and gold, serif headings, square corners, centered logo) or
  **Local / rustic** (warm paper tones, slab-serif headings). A theme sets
  the fonts (Google Fonts), colors, corners, header, homepage banner and
  product cards, and dresses every storefront page including cart,
  checkout and account forms. Per store: the accent color (or the theme's),
  the logo, and the homepage banner (on/off, headline, text, button, and its
  picture). The picture is built-in art drawn in the store's colors (two per
  theme: shapes and flowing lines, speed stripes and a game field, a neon
  grid and aurora, art deco and silk, hills and a topo map), so a new store
  looks finished straight away; any store can pick another art, none, or
  upload its own photo (`src/components/store/banner-art.tsx`). The Look tab
  previews each theme and shows the live store. New stores start with
  Minimal, or the theme chosen when publishing a quote to a new store
  (`src/lib/store/themes.ts`).
- **Page builder:** every store page (main site and affiliate stores) is
  edited as blocks: Text, Store showcase (which group, order including
  "closing soon", how many, cards or a list, columns, closed stores, and a
  search box and group buttons for shoppers) and Items (the store's own
  items: featured first, newest, name or lowest price). Drag blocks (or use
  the arrows) to reorder them. Blocks are saved as the page's text, so "Edit
  as text" shows Markdown with lines like `[[stores group="Schools"
  sort=closing layout=list filters]]` and `[[items featured]]`
  (`src/lib/store/showcase.ts`).
- **Visits:** store pages count visits (one per browser session) and page
  views per day, with no cookies or personal data and most bots left out.
  The stores list shows 30-day visits; a store's Overview adds a daily
  chart and the share of visits that ordered; owners see visits in the
  portal (`src/lib/store/visits.ts`).
- **Items** are priced per size from your pricing as a batch (base), with
  overrides and item, store or group markups. An item whose design has
  artwork placed gets its mockup as its picture (unless you upload one).
- **Names and numbers:** on a store item (Names & numbers), offer a name
  and/or number, optional or required, with a length limit, a price added
  per piece and where it's printed. Shoppers enter one per cart line; the
  order keeps them as the item's roster (with what each added) and the work
  order lists them by size. Staff can type a roster on any quote/order item
  (Names & numbers: `L, Smith, 12` per piece); it can't name more pieces
  than are ordered (`src/lib/store/personalization.ts`).
- **Batching** (store Settings → Batch orders): orders placed while the
  store is open are held (no production jobs, no blanks to buy). When the
  store closes, or when you press **Batch now** on its Overview, they're
  combined into one production order for the store's customer: the same
  designs merged, sizes added up, every name and number on its roster, no
  prices (the shoppers paid on their own orders). That order gets the
  production jobs and buys the blanks; the shoppers' orders move to In
  production and link to it. A held order can be produced on its own with
  "Produce now instead" (`src/lib/store/batches.ts`).
- **Commission** (store → Commission): a percentage of sales (after
  discounts, before tax and shipping) or an amount per piece. Each order
  keeps the commission worked out when it was placed; it's earned once the
  order is paid in full, and cancelled orders don't count. Record payouts
  there to see what's owed (`src/lib/store/commissions.ts`).
- **Owner portal** (`/owner` on a store's address, e.g.
  `tigers.companyname.com/owner`): the store's customer and any contacts
  you add (store → Owner portal) sign in with an emailed link, even while
  the store is closed or private. They see the sections you turn on
  (sales, orders with names and numbers, codes and their use, commission,
  requests) plus the store's contacts. **Requests** they send are emailed to
  you, posted to Slack if a webhook is saved (Defaults & payments), and
  flagged live in the back office: a red count next to Affiliate stores /
  All stores (checked every 30 seconds), on the store's row and its Requests
  tab. Answer them there (the owner is emailed) or make a draft quote from
  one; a store can make the quote automatically (`src/lib/store/portal.ts`).
- **Publish to a store** (on a quote or order, for store managers) puts its
  items in a new store for the customer or an existing one. Each item
  sells every size its color comes in, priced at the quantity ordered (or a
  batch quantity you enter). Publishing again either adds the items and
  updates the ones published from that quote/order before (names, uploaded
  pictures and price overrides stay), or replaces everything in the store.
  The order's activity records each publish (`src/lib/store/publish.ts`).
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

## Products

Each product has one page with a section list on the left (General, Colors,
Views & Decoration Areas, Images, Pricing, Decoration Methods & Minimums,
Sizing, Production, Supplier & Purchasing, SKUs & Inventory, Categories,
Decorated Products). Each section saves on its own. Decoration areas are
edited in place, so quote and order items stay linked when one is renamed or
resized.

Products show a thumbnail (the first view's photo in the first color) in the
products list, the product picker and on quote/order items. Photos from
supplier servers (`src/lib/catalog/image-hosts.ts`) are resized and cached by
Next.js; other photo links are shown as they are.

## Supplier catalogs

Suppliers → **Import a supplier catalog file** loads SanMar's product data
download (SanMar_SDL_N, as the zip or the CSV inside it, up to 50 MB). After
the file is read you choose brands, categories, whether to include
discontinued styles, and which SanMar price is your cost (piece, dozen or
case), then the import runs in the background with progress on the page.
Sizes are put in the usual garment order (S, M, L … 5XL, talls, youth,
toddler), since SanMar's own size index isn't reliable.

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
- Set `CRON_SECRET` and have a scheduler call `POST /api/cron/hourly` every
  hour with `Authorization: Bearer $CRON_SECRET` (e.g. `curl -fsS -X POST -H
  "Authorization: Bearer $CRON_SECRET" https://PLATFORM_DOMAIN/api/cron/hourly`).
  It batches stores that have closed, makes quote follow-up tasks and runs
  any automations still waiting.
  (`/api/cron/store-batches` does just the batching.)
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
| `src/lib/design/` | Design studio: artwork edits (pixels), placement and DPI math, mockups and mockup rendering |
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

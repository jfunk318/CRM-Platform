# Beeze Platform — Feature Specification

Version 0.1 · 2026-10-22 · Owner: Beeze Tees

A print-shop platform for Beeze Tees to replace its DecoNetwork subscription,
which has ended. It covers the storefront, online design tool, quoting and
ordering, artwork approvals, production, purchasing, shipping, CRM, and
affiliate/fundraiser stores.

## How this spec was built (and what it is not)

This is a **behavior-level, clean-room specification**. It describes *what*
the system must do. It contains no DecoNetwork source code, page templates,
branding, or catalog data, and none should be copied into this codebase.

Each requirement carries a source tag:

| Tag | Meaning |
|-----|---------|
| **[O]** | Observed on beezetees.com: storefront pages, the public JavaScript bundles (analyzed with REA), and the design-tool configuration embedded in product pages. |
| **[D]** | Described on deconetwork.com public feature/FAQ pages. Behavior is claimed by marketing copy, not observed. |
| **[B]** | Beeze Tees business data (your own settings), to be re-entered or imported. |
| **[R]** | Design recommendation for this build; not derived from DecoNetwork. |

Hard boundaries:

- **No catalog copying.** Supplier catalogs (SanMar, S&S, alphabroder…) must
  come from Beeze's own supplier accounts/APIs. DecoNetwork's catalog data is
  their IP (license §10.6).
- **No code/asset reuse.** Their JS bundles were analyzed only to learn
  behavior; nothing is ported. Fresh UI, fresh code.
- **Blank slate, import-ready** [B]: the new system starts empty, with
  import possible later (see Decisions). A one-time
  archive of the DecoNetwork data is still recommended for reference (see
  Decisions below), but nothing is imported.

## Evidence ledger (REA)

REA `analyze_javascript_application` (rea-agents 6.7.0) on the storefront
bundles, 2026-10-22. Coverage was **partial** on most files (semantic graph
capped at 20,000 nodes per file); conclusions below are from function/
property inventories, not execution.

| Input | Evidence ID (prefix) | Content |
|-------|----------------------|---------|
| bundle1 (application, lightwindow) | `ev_4ff7a085…` | site shell, popups |
| bundle2 (common/prototype) | `ev_dcaa4432…` | shared utils |
| bundle4 (blank product filter) | `ev_4402a601…` | catalog filtering |
| bundle3 parts 03–04, 08–14 (designer) | `ev_4ef2c01d…`, `ev_06f73cf1…`, `ev_b3b067c7…`, `ev_1f9c64cd…`, `ev_428fbb9c…`, `ev_2c5e8e97…`, `ev_57177920…`, `ev_2ee6dd57…`, `ev_70512ef9…` | design tool, cart, pricing, roles |

The 5.3 MB designer bundle timed out as a whole; it was split at top-level
statement boundaries and third-party libraries (Prototype, script.aculo.us,
Raphael, big.js) were excluded.

**Not observable from the storefront** (server-side only): decoration price
tables (referenced by ID only), CRM, admin back office, production board,
purchase orders, shipping, payouts. Those sections rely on [D] + [R].

---

## 1. Catalog & products

1.1 **Product model** [O]: name, style code, manufacturer, description, size
chart (table + image), spec sheet PDF, colors (each with light/dark/white
class), sizes and **sub-sizes**, views (front/back/sleeve…) with decoration
**areas** sized in inches, discontinued / closing-out / out-of-stock flags,
per-decoration-method **minimum quantity**, and per-method **production lead
days** (Beeze: 14 days for all methods [B]).

1.2 **Product categories** [O]: hierarchical (e.g. T-Shirts › Ladies,
Long Sleeve, Performance, Hooded, Full-Zip, Toddler; Good/Better/Best tiers).
Category listing with filtering by attributes [O].

1.3 **Bundles & minimums** [O]: products can require a minimum quantity,
fixed bundles, incremental bundles, or custom bundles.

1.4 **Supplier catalogs** [D]: live product data, pricing, colors, sizes and
stock from supplier APIs; auto-update on price/stock/discontinued changes.
Build connectors against **Beeze's own** supplier accounts [B][R]:

| Supplier | Integration approach [R] |
|----------|--------------------------|
| SanMar | SanMar web services / PromoStandards (product data, pricing, inventory, PO submission) |
| S&S Activewear | S&S REST API (products, pricing, inventory, orders) |
| Charles River Apparel | Confirm whether they offer PromoStandards or a data feed; otherwise CSV/price-list import |
| Pennant | Same as Charles River |

Design a supplier-adapter interface so every supplier (API, PromoStandards,
or CSV) feeds the same internal catalog model. Alphabroder is no longer used.

1.5 **Custom products** [D]: in-house items, kits/bundles, non-supplier blanks.

1.6 **Inventory** [O][D]: optional stock tracking per SKU; supplier stock
availability shown on product pages.

## 2. Pricing engine

2.1 **Blank garment price = supplier cost × markup** [O]. Beeze's markup is
a **flat 40% on wholesale cost** (price = cost × 1.40) for every product [B].
Cost-based tiers stay supported and editable per pricing group (the old
storefront used 60/55/40/30/20% tiers by cost), as does margin mode.

2.2 **Pricing groups** [O]: separate price lists per customer group/store
(several group IDs observed). Customer-specific discount % [O].

2.3 **Decoration pricing per method** [O]: each method has its own price
table (contents server-side, **unknown** — re-enter from your admin), with
pricing modes including **area-based pricing** (by sq. inches) and per-color
(screen print) or per-stitch-count (embroidery) [O][D].

2.4 **Quantity-break discounts** [O]: tables of {min qty → % off}. Beeze's
observed tables [B]: {5→0%,10→0%}, {100→50%}, {5→3%,10→5%,15→10%}, {5→20%}.

2.5 **Setup & extra fees** [O]: screen setup fee (per screen, with white-base
screen fee), artwork fee, digitizing fee (flat or per inch), proofing fee,
rush-order fee, payment surcharge.

2.6 **Taxes** [O][D]: multiple tax rates, by postcode/region; per-fee flags
for whether tax applies to shipping, artwork, digitizing, rush fee, screen
setup, payment surcharge; tax-exempt customers/sites.

2.7 **Price display** [O]: rounding rules, optional ".99" pricing, currency
setting.

2.8 **Process mixing** [O]: one product can combine decoration methods
across views/areas (all pairs of Beeze's methods allowed).

## 3. Decoration methods

Beeze's configured methods [B][O]:

| ID | Method | Notable settings |
|----|--------|------------------|
| 1 | DTF No Minimum Printing: Full Color | full color |
| 2 | Full Color Digital Printing | full color |
| 3 | Embroidery | stitch counts, digitizing |
| 8 | Screen Printing: 1–8 Colors | max 8 colors, **min qty 12**, 300 DPI min, color palettes, color tracking |
| 12 | Vinyl Heat Transfer | |
| 17 | Screen Printed Transfers | |
| 26 | Printing | |
| 31 | Engraving | |

Per-method capability flags [O]: allow text / images / uploads / team names;
allow text effects, warp, outline, gradients; image resize/effects/borders;
crop raster uploads; min & "perfect" DPI; max colors; limit to palettes;
track used colors; visualize colors; auto-digitize (embroidery); embroidery
recoloring; proofing required; allowed file formats; store restrictions.

## 4. Online design tool

All [O] unless marked.

4.1 **Canvas** per product view, with highlighted decoration areas; zoom;
area selection; multiple views per product; background/garment color switch.

4.2 **Layers ("items")**: text, image, template text, screen (reusable
screen-printed art), team names/numbers. Each item: move, resize (sizer
handles), rotate (with snap buttons), center H/V, lock, z-order, copy/paste
across areas/views, delete; constrained to the decoration area with
"outside area" warnings.

4.3 **Text**: font picker (managed font library), size, alignment, color,
outline, effects/warp, gradient; UTF-8 support; sanitization.

4.4 **Images**: upload (raster + vector: emb, eps, ps, svg, gif, jpg, png,
tiff, pdf [D]), clip-art/design library with categories, replace/clear,
aspect lock, borders, effects, color-way changes, **image quality check**
(DPI at print size, with customer-acknowledged warning).

4.5 **Color handling**: detected color count for uploads, per-screen color
assignment, white base (underbase) for darks, palette-restricted color
pickers (with eyedropper), CMYK/RGB/Lab conversion for matching.

4.6 **Team names & numbers**: roster editor (name, number, size per member),
grouping by size, templates, roster drives line-item quantities.

4.7 **Artwork jobs**: customer can request artwork/digitizing service from
inside the designer; fees attached to the line item.

4.8 **Live pricing** in the designer as items are added (decoration price,
extra charges, quantity breaks), size/qty matrix, "request a quote" path,
save working version (named designs), email design, continue shopping.

4.9 **Rendering**: server-rendered mockup thumbnails per view; embroidery
stitch simulation [D].

Implementation [R]: canvas library (Fabric.js or Konva) with a JSON design
document as the source of truth; server renders mockups and print-ready
files from the same document.

## 5. Storefront (website)

5.1 CMS pages with nested hierarchy [O] (services, locations/SEO landing
pages, blog, about, careers, sponsorships, quote request, file upload, file
downloads, track your order, webstores).
5.2 Navigation with dropdown submenus, mobile menu [O].
5.3 Search [O]; category browsing; product pages with size chart, spec sheet,
shipping/FAQ popups [O].
5.4 Forms with reCAPTCHA v3 [O]: contact, quote request, file upload.
5.5 Analytics hooks [O]: Google Analytics 4 e-commerce events (view_item…),
Google Tag Manager, Meta Pixel; third-party widget embeds (Elfsight) [O].
5.6 SEO [O][D]: canonical tags, robots control, structured data for Google
Shopping [D], localization/translate [D].
5.7 Multi-currency [O].

## 6. Cart, checkout & payments

6.1 Cart [O]: multiple decorated or blank line items, edit line in designer,
coupon codes, gift certificates, rush order option, attachments per line.
6.2 Checkout [O][D]: shipping address & methods, tax calc, payment surcharge.
6.3 Payments [D]: card, Apple/Google Pay, BNPL (Affirm/Afterpay/Klarna),
deposits and partial payments, failed-payment retry, disputes.
Implementation [R]: Stripe (Payment Element + Checkout) directly on your own
Stripe account.
6.4 Customer accounts [O][D]: signup/login, forgot password, **email-token
(magic link) access**, order history, view order, approve artwork, review
quotes, download invoices.
6.5 Order tracking page [O].

## 7. Quotes

[D]: build quotes from catalog products + decoration methods with live
pricing; send a link for online approve / reject / request changes;
automatic reminders; status (pending / approved / rejected / converted);
collaborative comments; edit and resend; one-click convert to order.
[O]: designer "request quote" mode and "quick quote" configuration.

## 8. Orders

[D]: one list from creation to shipment; manual orders or converted from
quotes/web/store orders; staff upload and assign artwork; template emails
(order details, payment links, status updates); edit after approval with
re-pricing; change history; multi-user editing.

## 9. Artwork & approvals

[D]: approval inside a sales order or standalone; assign to staff; emailed
approval link; approve/reject with notes and attachments; manual rejection;
versioned files (original, revised, production-ready); PDF approval sheet
(artwork, size, colors, placement measurements, product).
[O]: artwork-job objects linked to design items; artwork access roles.

## 10. Production

[D]: per-method workflows with custom steps (add/rename/reorder);
production calendar with drag-to-reschedule; auto-assignment by due date,
capacity, method; job status board; batch store orders into one production
run; production file sync (e.g. Google Drive) [D].

## 11. Purchasing & inventory

[D]: auto-generate POs consolidated by supplier from open orders; manual POs;
edit POs; partial receiving; send via supplier API or emailed PDF; blind
shipping; PO ↔ sales-order links and history; low-stock alerts.

## 12. Shipping

[D]: shipping list dashboard; carrier rates and labels (UPS, FedEx, USPS,
DHL…); multi-package and partial shipments; packing slips / order slips
(bulk print); tracking emails and SMS.
Implementation [R]: EasyPost or Shippo for rates/labels.

## 13. CRM

Mostly server-side; requirements are [D] + [R]. [O] shows: CRM lead creation
on signup (`check_signup_crm_lead`), customer groups tied to pricing,
customer discounts, sales-role permissions.

13.1 Contacts and companies, with multiple contacts per company [R].
13.2 Leads from signups, contact/quote forms, and manual entry; lead → customer conversion [O][R].
13.3 Activity timeline per customer: quotes, orders, invoices, approvals, emails, notes [R].
13.4 Tasks and follow-ups assigned to sales reps, with due dates [R].
13.5 Sales pipeline built on quote statuses [D][R].
13.6 Customer groups → price lists, tax-exempt status, payment terms [O][R].
13.7 Email marketing sync (Mailchimp) and optional Zoho CRM sync [D].
13.8 Messaging with affiliate store owners [D].

## 14. Affiliate, team & fundraiser stores

[D] + [O] (`get_affiliate_signup_tax_rate`, `affiliate_aggreement`,
`new_campaign_product`, campaign flags, affiliate discount in cart, site
commission/wholesale rate fields).

14.1 **Store types**: affiliate (the client sells its own merch), fundraiser
(raising money for a cause), team/school/corporate (closed stores) [D].
14.2 Each store has its own branding, subdomain or path, product selection,
artwork, and allowed customization options [D].
14.3 Affiliate signup with an e-signed affiliate agreement and tax-rate
capture [O].
14.4 **Campaign products**: pre-decorated products the store owner sets up,
with personalization optionally allowed (e.g. names/numbers) [O].
14.5 **Commissions**: per-store commission rate or wholesale-price model.
Beeze collects every payment; commission totals are tracked and paid out to
the store owner [D][O]. Payouts can be manual, recorded payouts first, with
Stripe Connect optional later [R].
14.6 Store open/close dates and group ordering. Orders are batched into one
production run when the store closes [D].
14.7 Store-owner dashboard: sales, orders, commission earned and paid [R].
14.8 Optional password or access-code protected stores (team/corporate) [R].

## 15. Invoicing & accounting

[D]: invoices from quotes and orders; custom layout, numbering and prefixes;
paid/pending/overdue status; email with a payment link; deposits.
Accounting sync: **QuickBooks Online** [B] (customers, invoices, payments).
Other accounting systems are out of scope.

## 16. Staff, roles & permissions

[O] roles: admin, sales, artwork, manage-artwork, production, purchasing,
shipping, process-refunds. Role checks apply throughout the back office.
[R]: multiple staff accounts, audit log, assignment of staff to workflow steps.

## 17. Automations

[D]: trigger → action rules. Example triggers: order placed, artwork
approved, step completed, store closed, stock low. Example actions: change
status, assign staff, send email/SMS, generate PO, generate documents.
[R]: build this on a background job queue, with a rules table editable in
admin.

## 18. Integrations & API

[D]: public REST API for orders; QuickBooks/Xero; Mailchimp; Zoho CRM;
ShipStation/Stamps/carriers; Google Ads/Analytics; Meta Pixel; Shopify.
Shopify product sync was observed in the admin code (`manage_site/shopify/*`) [O].
[R]: build a REST API from day one; the admin UI uses the same API.

---

## Explicitly out of scope / deferred

- DecoNetwork's design library (licensed clip art) — not transferable; use
  your own art or a licensed library [R].
- AI assistant ("Demi") [D] — optional later.
- Multi-location / fulfillment-network features [D] — defer.
- POS / in-person payments [D] — defer.

## Decisions (2026-10-22)

- **Blank slate, import-ready.** Launch with no migrated data. The catalog,
  inventory and order flow stay as specified here; the change is in how
  staff perform the work. Importable records carry `externalSource` +
  `externalId` so data can be imported later if needed. Recommended anyway: a one-time **reference archive** before
  DecoNetwork access ends: customer list, decoration price tables, artwork
  files and open affiliate stores. These are not for import; they're the
  only record of your current decoration prices, and useful for re-entering
  customers and stores by hand.
- **Suppliers:** SanMar, S&S Activewear, Charles River, Pennant.
- **Accounting:** QuickBooks Online.

## Open questions for Beeze

1. **Staffing:** how will work be divided among staff? This shapes roles,
   workflow steps and task assignment (phases 4–5).
2. Do you have API credentials for SanMar and S&S? Do Charles River and
   Pennant offer data feeds?
3. How many affiliate/fundraiser stores are live, and how are commissions
   paid today?
4. Do you need to keep the same URLs on beezetees.com (`/create/…`,
   `/page/…`) to preserve SEO?

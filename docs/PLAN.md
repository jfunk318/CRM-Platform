# Beeze Platform — Build Plan

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

Each phase ends with something usable.

1. **Foundation + catalog + pricing engine.** Repo, database schema, staff
   auth and roles, products/colors/sizes/views/areas, categories, decoration
   methods, markup tiers, quantity breaks, fees, and taxes. Pricing engine
   unit-tested against your current prices.
2. **Storefront + cart + checkout.** CMS pages, category and product pages,
   blank-product ordering, cart, coupons, Stripe checkout, customer accounts,
   order tracking. *Can go live for blank and quote-request sales.*
3. **Design tool.** Canvas, text, images, upload with quality checks,
   colors and screens, team names, live pricing, saved designs, mockup
   rendering. *Full decorated ordering online.*
4. **Back office: quotes, orders, artwork approvals, invoices.** Quote
   builder with an approval link, quote-to-order, order editing, approval
   workflow with PDF proof sheets, invoices with payment links, deposits.
5. **Production, purchasing, shipping.** Workflows and steps, production
   calendar, consolidated supplier POs and receiving, shipping labels,
   packing slips, tracking notifications.
6. **CRM.** Contacts and companies, leads, activity timeline, tasks,
   pipeline, customer groups, Mailchimp sync.
7. **Affiliate, team and fundraiser stores.** Store builder, campaign
   products, open/close dates, commission tracking and payouts, store-owner
   dashboard, batched production.
8. **Automations + integrations.** Rules engine, QuickBooks Online, supplier
   live catalogs and ordering, public API.
9. **Cutover.** Set up URL redirects from the old beezetees.com paths to
   keep SEO, then switch DNS. No data import (fresh start).

Supplier catalog connectors (SanMar and S&S first, then Charles River and
Pennant) start alongside phase 1 once you have API credentials, because
phases 1–3 need real product data.

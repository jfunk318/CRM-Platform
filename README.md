# Name TBD

Working name for a print-shop business platform: storefront, online design
tool, quotes, orders, production, CRM and affiliate stores. Many print shops
run their business **through** the platform; Beeze Tees is the first.

| Level | Example | Where it lives |
|-------|---------|----------------|
| Platform | Name TBD | `PLATFORM_DOMAIN` (e.g. `nametbd.com`); admin at `/platform` |
| Business | Beeze Tees | its own domain (`beezetees.com`) or `<slug>.<PLATFORM_DOMAIN>`; back office at `/admin` |
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
npm run db:seed             # platform admin + Beeze Tees with starter data (safe to re-run)
npm test                    # unit tests + database tests (need DATABASE_URL)
npm run dev
```

Then:

- **Platform admin:** http://localhost:3000/platform (the `SEED_PLATFORM_ADMIN_*` login)
- **Beeze Tees back office:** http://beezetees.localhost:3000/admin (the `SEED_ADMIN_*` login)
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

## Production notes

- Set `PLATFORM_DOMAIN`. `localhost` shortcuts are off in production.
- Point `PLATFORM_DOMAIN`, `*.PLATFORM_DOMAIN` and each business's custom
  domain (plus `*.customdomain` for its stores) at the app, with TLS for each.
- Run behind a proxy that sets `X-Forwarded-Host`.

## Layout

| Path | What |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts`, `seed-data.ts` | Development setup: platform admin, Beeze Tees and its starter data |
| `src/lib/db.ts` | Database clients: unscoped `prisma` and business-scoped `forBusiness()` |
| `src/lib/business.ts`, `hosts.ts` | Which business a request is for, from its host name |
| `src/lib/platform/` | Platform name and the defaults every new business starts with |
| `src/lib/pricing/` | Pricing engine (pure functions) and `load.ts`, which builds engine input from the database |
| `src/lib/auth/` | Passwords, staff and platform sessions, roles |
| `src/lib/orders/` | Quotes and orders: numbering, line/design editing, conversion, repricing |
| `src/app/admin/` | A business's back office |
| `src/app/platform/` | Platform admin: businesses |

## Importing data later

Records that could come from another system (products, variants, categories,
decoration methods, pricing groups, customers, orders) carry
`externalSource` + `externalId`, unique per business. An importer upserts on
that pair, so importing is repeatable and never duplicates rows.

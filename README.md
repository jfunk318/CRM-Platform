# Beeze Platform

Print-shop platform for Beeze Tees: storefront, online design tool, quotes,
orders, production, CRM and affiliate stores.

- [Feature spec](docs/SPEC.md)
- [Build plan](docs/PLAN.md)

## Development

Requires Node.js 22 and PostgreSQL 16.

```bash
npm install
cp .env.example .env
docker compose up -d        # or point DATABASE_URL at your own Postgres
npm run db:migrate          # create tables
npm run db:seed             # Beeze starting config (safe to re-run);
                            # set SEED_ADMIN_EMAIL/PASSWORD in .env first
                            # to create the first admin
npm test                    # unit tests + database tests (need DATABASE_URL)
npm run dev                 # admin at http://localhost:3000/admin
```

## Layout

| Path | What |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `prisma/seed-data.ts` | Beeze starting configuration (methods, markup tiers, discounts, suppliers, categories) |
| `src/lib/pricing/` | Pricing engine (pure functions) and `load.ts`, which builds engine input from the database |
| `src/lib/auth/` | Staff passwords, sessions and roles |
| `src/lib/orders/` | Quotes and orders: numbering, line/design editing, conversion, repricing |
| `src/app/admin/` | Back office: quotes and orders, customers, catalog, methods and price tables, pricing, tax, statuses, staff, price check |

## Importing data later

Records that could come from another system (products, variants, categories,
decoration methods, pricing groups) carry `externalSource` + `externalId`,
unique together. An importer upserts on that pair, so importing is
repeatable and never duplicates rows.

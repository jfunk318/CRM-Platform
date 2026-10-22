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
npm run db:seed             # Beeze starting config (safe to re-run)
npm test                    # pricing engine tests
npm run dev
```

## Layout

| Path | What |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `prisma/seed-data.ts` | Beeze starting configuration (methods, markup tiers, discounts, suppliers, categories) |
| `src/lib/pricing/` | Pricing engine: pure functions, no database access |

## Importing data later

Records that could come from another system (products, variants, categories,
decoration methods, pricing groups) carry `externalSource` + `externalId`,
unique together. An importer upserts on that pair, so importing is
repeatable and never duplicates rows.

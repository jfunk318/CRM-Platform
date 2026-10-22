import { Prisma, PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Unscoped client. Only for platform-level work (businesses, platform users)
 * and for finding which business a request or session belongs to. Business
 * data must go through forBusiness().
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Models that aren't owned by a business. Everything else is. */
const PLATFORM_MODELS = new Set<string>(["Business", "PlatformUser", "PlatformSession", "StaffSession"]);
export const BUSINESS_MODELS = new Set<string>(Object.values(Prisma.ModelName).filter((m) => !PLATFORM_MODELS.has(m)));

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

/**
 * A client that can only see and change one business's data: every query
 * on a business model is filtered by businessId, and every create is
 * stamped with it. Nested creates inherit businessId through the composite
 * relations in the schema, and the database rejects cross-business links.
 */
export function forBusiness(businessId: string) {
  return prisma.$extends({
    name: "business-scope",
    client: { $businessId: businessId },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!BUSINESS_MODELS.has(model)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as any;
          if (WHERE_OPERATIONS.has(operation)) {
            a.where = { ...a.where, businessId };
          } else if (operation === "create") {
            // Any businessId in the data is replaced with this business's.
            a.data = { ...a.data, businessId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, businessId }));
          } else if (operation === "upsert") {
            a.where = { ...a.where, businessId };
            a.create = { ...a.create, businessId };
          }
          return query(a);
        },
      },
    },
  });
}

export type BusinessDb = ReturnType<typeof forBusiness>;
/** A business-scoped client or a transaction opened from one. */
export type BusinessTx = Omit<BusinessDb, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

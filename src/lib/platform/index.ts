/**
 * The platform's own brand, as opposed to the business running on it
 * (whose name and domain are shop settings, see lib/shop.ts).
 * "Name TBD" until the platform is named; set PLATFORM_NAME to change it.
 */
export const PLATFORM_NAME = process.env.PLATFORM_NAME?.trim() || "Name TBD";

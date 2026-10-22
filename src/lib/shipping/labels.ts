import type { DeliveryKind } from "@prisma/client";

export const CARRIERS: Record<string, { name: string; url: (n: string) => string }> = {
  ups: { name: "UPS", url: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  usps: { name: "USPS", url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
  fedex: { name: "FedEx", url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  dhl: { name: "DHL", url: (n) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}` },
};

export const DELIVERY_KIND_LABELS: Record<DeliveryKind, string> = { SHIP: "Ship", PICKUP: "Pickup", DELIVERY: "Local delivery" };

export const carrierName = (c: string | null | undefined) => (c ? (CARRIERS[c]?.name ?? c) : null);
export const trackingUrl = (carrier: string | null | undefined, number: string | null | undefined) =>
  carrier && number && CARRIERS[carrier] ? CARRIERS[carrier].url(number) : null;

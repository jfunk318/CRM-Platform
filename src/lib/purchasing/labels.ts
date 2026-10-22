import type { PurchaseOrderStatus } from "@prisma/client";

export const PO_STATUS: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-800" },
  PARTIAL: { label: "Partly received", className: "bg-amber-50 text-amber-900" },
  RECEIVED: { label: "Received", className: "bg-green-50 text-green-800" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

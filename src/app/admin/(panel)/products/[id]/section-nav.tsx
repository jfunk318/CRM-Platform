"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECTIONS = [
  { path: "", label: "General" },
  { path: "colors", label: "Colors" },
  { path: "views", label: "Views & Decoration Areas" },
  { path: "images", label: "Images" },
  { path: "pricing", label: "Pricing" },
  { path: "methods", label: "Decoration Methods & Minimums" },
  { path: "sizing", label: "Sizing" },
  { path: "production", label: "Production" },
  { path: "supplier", label: "Supplier & Purchasing" },
  { path: "inventory", label: "SKUs & Inventory" },
  { path: "categories", label: "Categories" },
  { path: "designs", label: "Decorated Products" },
] as const;

/** The product page's section list, with the current section marked. */
export function SectionNav({ productId }: { productId: string }) {
  const pathname = usePathname();
  const base = `/admin/products/${productId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto py-2 text-sm md:flex-col md:gap-0" aria-label="Product sections" data-testid="product-sections">
      {SECTIONS.map((s) => {
        const href = s.path ? `${base}/${s.path}` : base;
        const current = pathname === href;
        return (
          <Link
            key={s.path}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded px-3 py-1.5 md:rounded-none md:border-l-2 md:px-4 ${
              current ? "bg-amber-50 font-medium text-amber-900 md:border-amber-500" : "text-gray-700 hover:bg-gray-50 md:border-transparent"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

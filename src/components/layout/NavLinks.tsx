"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/format";

export type NavItem = { href: string; label: string };

// Labels arrive as props from Server Components, so no translation runtime ships to the browser.
export function NavLinks({
  items,
  orientation = "horizontal",
  onNavigate,
}: {
  items: NavItem[];
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className={cx("flex", orientation === "horizontal" ? "items-center gap-1" : "flex-col gap-1")}>
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center rounded-sm px-3 font-medium no-underline transition-colors",
                orientation === "vertical" && "type-lead px-0",
                current ? "text-bronze-deep" : "text-ink hover:text-bronze-deep",
              )}
            >
              <span className={cx(current && "underline decoration-bronze underline-offset-[0.45em]")}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

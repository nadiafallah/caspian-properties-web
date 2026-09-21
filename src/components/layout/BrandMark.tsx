import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/format";

/**
 * Interim header lock-up: approved monogram plate (extracted from the brand guide,
 * TEMPORARY until the vector signature set exists) + live-text name.
 * Kept LTR in every locale — logos are never mirrored (brand guide §2.7).
 */
export function BrandMark({ label, tone = "light" }: { label: string; tone?: "light" | "dark" }) {
  return (
    <Link href="/" aria-label={label} dir="ltr" className="inline-flex min-h-11 items-center gap-3 no-underline">
      <Image
        src="/brand/monogram-plate.png"
        alt=""
        width={38}
        height={40}
        priority
        className="h-10 w-auto"
      />
      <span className="flex flex-col leading-none">
        <span
          className={cx(
            "font-display text-[1.375rem] font-semibold tracking-[0.18em]",
            tone === "light" ? "text-ink" : "text-white",
          )}
        >
          NADIA
        </span>
        <span
          className={cx(
            "mt-1 font-sans text-[0.625rem] font-medium tracking-[0.12em] uppercase",
            tone === "light" ? "text-muted" : "text-bronze-light",
          )}
        >
          Caspian Properties · Since 2007
        </span>
      </span>
    </Link>
  );
}

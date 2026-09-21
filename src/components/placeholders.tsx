import { isLaunch } from "@/config/site";
import { cx } from "@/lib/format";

/**
 * Abstract tonal block standing in for approved photography. It can never be mistaken
 * for a real property or person. In preview stage it is labelled; `data-placeholder`
 * lets `npm run check:content` block a launch build while placeholders remain.
 */
export function ImagePlaceholder({
  label,
  className,
  tone = "stone",
}: {
  label: string;
  className?: string;
  tone?: "stone" | "charcoal";
}) {
  return (
    <div
      data-placeholder="image"
      role={isLaunch ? undefined : "img"}
      aria-label={isLaunch ? undefined : label}
      aria-hidden={isLaunch ? true : undefined}
      className={cx(
        "relative overflow-hidden",
        tone === "stone" ? "bg-[#cfc6bd]" : "bg-[#4a4543]",
        className,
      )}
      style={{
        backgroundImage:
          tone === "stone"
            ? "linear-gradient(160deg, rgb(247 242 236 / 0.55), transparent 55%), repeating-linear-gradient(135deg, rgb(255 255 255 / 0.10) 0 1px, transparent 1px 14px)"
            : "linear-gradient(160deg, rgb(233 175 139 / 0.18), transparent 60%), repeating-linear-gradient(135deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 14px)",
      }}
    >
      {isLaunch ? null : (
        <span className="type-caption absolute inset-x-3 top-3 rounded-sm bg-white/90 px-2 py-1 text-ink">
          {label}
        </span>
      )}
    </div>
  );
}

/** Visible reviewer marker for content awaiting Nadia’s input. Renders nothing at launch. */
export function ContentNeeded({ label, what }: { label: string; what: string }) {
  if (isLaunch) return null;
  return (
    <p
      data-content-needed={what}
      className="type-small rounded-card border border-dashed border-stone-strong bg-ivory px-4 py-3 text-muted"
    >
      <strong className="font-semibold text-ink">{label}:</strong> {what}
    </p>
  );
}

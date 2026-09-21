"use client";

/**
 * Shows the reduced, watermarked broker-card preview as a CSS background so the
 * browser offers no "Save image" item, and blocks drag / long-press / context menu
 * on this element only. This deters casual copying; it cannot prevent screenshots —
 * nothing on the web can. The official DLD verification link is the real proof.
 */
export function CardPreview({ src, label }: { src: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      className="aspect-[720/466] w-full rounded-card border border-stone bg-charcoal bg-cover bg-center select-none [-webkit-touch-callout:none]"
      style={{ backgroundImage: `url("${src}")` }}
    />
  );
}

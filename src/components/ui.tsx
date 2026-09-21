import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/format";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-content px-5 md:px-6", className)}>{children}</div>;
}

type Surface = "white" | "ivory" | "dark";

const surfaceClass: Record<Surface, string> = {
  white: "bg-white text-ink",
  ivory: "bg-ivory text-ink",
  dark: "surface-dark bg-charcoal text-white",
};

export function Section({
  surface = "white",
  labelledBy,
  id,
  className,
  children,
}: {
  surface?: Surface;
  labelledBy?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx(surfaceClass[surface], "py-16 md:py-24", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("proof-label text-bronze-deep [.surface-dark_&]:text-bronze-light", className)}>{children}</p>;
}

/** Eyebrow + heading + optional lead, used at the top of most sections. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  level = 2,
  className,
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  level?: 1 | 2;
  className?: string;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={cx("max-w-3xl", className)}>
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      <Heading id={id} className={level === 1 ? "type-h1" : "type-h2"}>
        {title}
      </Heading>
      {lead ? (
        <p className="type-lead mt-5 max-w-measure text-muted [.surface-dark_&]:text-stone">{lead}</p>
      ) : null}
    </div>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: "primary" | "secondary" };

export function ButtonLink({ variant = "primary", className, children, ...props }: ButtonLinkProps) {
  return (
    <Link {...props} className={cx("btn", variant === "primary" ? "btn-primary" : "btn-secondary", className)}>
      {children}
    </Link>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      className={cx("flip-rtl h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      className={cx("h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Text link with an arrow that points forward in both LTR and RTL. */
export function ArrowLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cx("link inline-flex min-h-11 items-center gap-2", className)}>
      {children}
      <ArrowIcon />
    </Link>
  );
}

/** Ivory page intro with the page’s single h1. */
export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="bg-ivory">
      <Container className="pt-14 pb-16 md:pt-20 md:pb-20">
        <SectionHeading id="page-title" level={1} eyebrow={eyebrow} title={title} lead={lead} />
        {children}
      </Container>
    </section>
  );
}

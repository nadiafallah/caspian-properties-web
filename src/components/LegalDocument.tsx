import type { ReactNode } from "react";
import { Container } from "@/components/ui";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Readable single-column legal page with in-page contents. */
export function LegalDocument({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <article aria-labelledby="page-title">
      <header className="bg-ivory">
        <Container className="pt-14 pb-12 md:pt-20">
          <p className="proof-label text-bronze-deep">{eyebrow}</p>
          <h1 id="page-title" className="type-h1 mt-4">
            {title}
          </h1>
          <p className="type-small mt-4 text-muted">{updated}</p>
          <p className="type-lead mt-6 max-w-measure text-charcoal">{intro}</p>
        </Container>
      </header>
      <Container className="py-14 md:py-20">
        <div className="max-w-measure space-y-10">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} className="type-h3">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-charcoal">{section.body}</div>
            </section>
          ))}
        </div>
      </Container>
    </article>
  );
}

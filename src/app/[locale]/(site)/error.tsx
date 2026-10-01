"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Container } from "@/components/ui";

// Kept local so error pages never depend on the translation runtime.
const strings = {
  en: { title: "Something went wrong", body: "Please try again. If the problem continues, contact us directly.", retry: "Try again" },
  fa: { title: "مشکلی پیش آمد", body: "لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، مستقیم با ما تماس بگیرید.", retry: "تلاش دوباره" },
  ar: { title: "حدث خطأ ما", body: "يُرجى المحاولة مجدداً. وإذا استمرت المشكلة، تواصل معنا مباشرة.", retry: "إعادة المحاولة" },
} as const;

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const t = strings[(params.locale as keyof typeof strings) ?? "en"] ?? strings.en;

  useEffect(() => {
    // Log only the digest — never user data.
    if (error.digest) console.error(`[page-error] digest=${error.digest}`);
  }, [error.digest]);

  return (
    <section aria-labelledby="error-title" className="bg-ivory py-24">
      <Container>
        <h1 id="error-title" className="type-h1">
          {t.title}
        </h1>
        <p className="type-lead mt-5 max-w-measure text-muted">{t.body}</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-8">
          {t.retry}
        </button>
      </Container>
    </section>
  );
}

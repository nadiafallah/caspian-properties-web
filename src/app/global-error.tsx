"use client";

import "./globals.css";

// Last-resort boundary when the root layout itself fails. Kept dependency-free.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-ivory">
        <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center px-5 py-24">
          <h1 className="type-h1">Something went wrong</h1>
          <p className="type-lead mt-5 max-w-measure text-muted">
            Please try again. If the problem continues, contact us directly.
          </p>
          <p className="mt-8">
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
          </p>
        </main>
      </body>
    </html>
  );
}

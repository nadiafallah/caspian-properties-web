import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Page not found · Caspian Properties by Nadia",
  robots: { index: false },
};

// Requests that match no locale route at all (e.g. /unknown.php). English only by design.
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-ivory">
        <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center px-5 py-24">
          <p className="proof-label text-bronze-deep">404</p>
          <h1 className="type-h1 mt-4">Page not found</h1>
          <p className="type-lead mt-5 max-w-measure text-muted">
            The page you’re looking for doesn’t exist or has moved.
          </p>
          <p className="mt-8">
            <Link href="/" className="btn btn-primary">
              Back to home
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
const calOrigin = (process.env.NEXT_PUBLIC_CALCOM_ORIGIN || "https://app.cal.com").replace(/\/$/, "");

// Pages are statically rendered, so a nonce-based CSP is not used (it would force
// dynamic rendering). Next.js and the Cal.com embed need inline scripts; everything
// else is locked to our own origin plus the Cal.com origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${calOrigin}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${calOrigin}${isDev ? " ws:" : ""}`,
  `frame-src ${calOrigin} https://cal.com`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    globalNotFound: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The licence-card preview is for on-page verification only.
        source: "/credentials/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, noimageindex, noarchive" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

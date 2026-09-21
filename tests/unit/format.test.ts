import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatNumeral } from "@/lib/format";
import { isAppLocale, localeMeta } from "@/i18n/locales";

describe("locale helpers", () => {
  it("formats legal dates in the Gregorian calendar for every locale", () => {
    expect(formatDate("en", "2027-05-08")).toBe("8 May 2027");
    expect(formatDate("fa", "2027-05-08")).toContain("۲۰۲۷");
    expect(formatDate("ar", "2027-05-08")).toContain("2027");
  });

  it("uses Persian digits for fa and Western digits for ar (UAE convention)", () => {
    expect(formatNumber("fa", 2007)).toBe("۲۰۰۷");
    expect(formatNumber("ar", 2007)).toBe("2007");
    expect(formatNumeral("en", 3)).toBe("03");
    expect(formatNumeral("fa", 3)).toBe("۰۳");
  });

  it("marks Persian and Arabic as right-to-left", () => {
    expect(localeMeta.en.dir).toBe("ltr");
    expect(localeMeta.fa.dir).toBe("rtl");
    expect(localeMeta.ar.dir).toBe("rtl");
    expect(isAppLocale("fa")).toBe(true);
    expect(isAppLocale("de")).toBe(false);
  });
});

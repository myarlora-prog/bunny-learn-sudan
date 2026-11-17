import { describe, expect, it } from "vitest";
import { buildReferralMessage, cleanReferralShare, validAppUrl } from "./referral-share";

describe("owner referral invitation", () => {
  it("uses the saved message and inserts a clickable HTTPS app link", () => {
    const settings = cleanReferralShare({ message: "تعلّم معي في نوابغ\n{link}\nالكود {code}", url: "https://bunny-learn-sudan.lovable.app" });
    const text = buildReferralMessage(settings, "SAQRO-ABC123");
    expect(text).toContain("تعلّم معي في نوابغ");
    expect(text).toContain("https://bunny-learn-sudan.lovable.app");
    expect(text).toContain("SAQRO-ABC123");
  });

  it("keeps the referral code and link when the owner omits placeholders", () => {
    const text = buildReferralMessage({ message: "رسالة جديدة بالكامل", url: "https://example.com/app" }, "CODE-1");
    expect(text).toContain("CODE-1");
    expect(text).toContain("https://example.com/app");
  });

  it("rejects insecure or credential-bearing app links", () => {
    expect(validAppUrl("http://example.com")).toBe(false);
    expect(validAppUrl("https://user:pass@example.com")).toBe(false);
    expect(validAppUrl("https://example.com/app")).toBe(true);
  });
});

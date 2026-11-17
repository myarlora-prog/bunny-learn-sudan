import { describe, expect, it } from "vitest";
import { countrySupportUrl } from "./support";

describe("saved country WhatsApp support", () => {
  it("uses the number configured for the selected country", () => {
    const url = countrySupportUrl('{"السودان":"249900000000"}', "السودان", "الدولة الحالية: السودان");
    expect(url).toBe("https://wa.me/249900000000?text=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A9%20%D8%A7%D9%84%D8%AD%D8%A7%D9%84%D9%8A%D8%A9%3A%20%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86");
  });

  it("supports the legacy single Saudi number only for Saudi Arabia", () => {
    expect(countrySupportUrl("966557110297", "السعودية", "اختبار")).toContain("https://wa.me/966557110297");
    expect(countrySupportUrl("966557110297", "السودان", "اختبار")).toBeNull();
  });

  it("never creates a contact before a valid saved number exists", () => {
    expect(countrySupportUrl(null, "السودان", "اختبار")).toBeNull();
    expect(countrySupportUrl("{}", "السودان", "اختبار")).toBeNull();
  });
});

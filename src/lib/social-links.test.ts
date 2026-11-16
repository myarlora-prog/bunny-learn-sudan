import { describe, expect, it } from "vitest";
import { cleanSocialLinks, validSocialUrl } from "./social-links";

describe("owner social links", () => {
  it("accepts official HTTPS platform accounts", () => {
    expect(validSocialUrl("instagram", "https://www.instagram.com/nawabig")).toBe(true);
    expect(validSocialUrl("tiktok", "https://www.tiktok.com/@nawabig")).toBe(true);
    expect(validSocialUrl("facebook", "https://facebook.com/nawabig")).toBe(true);
  });

  it("rejects insecure, lookalike and cross-platform URLs", () => {
    expect(validSocialUrl("instagram", "http://instagram.com/nawabig")).toBe(false);
    expect(validSocialUrl("instagram", "https://instagram.com.example.org/nawabig")).toBe(false);
    expect(validSocialUrl("instagram", "https://tiktok.com/@nawabig")).toBe(false);
  });

  it("omits empty and invalid platforms from student display", () => {
    expect(cleanSocialLinks({ instagram: "", tiktok: "not-a-url", facebook: "https://facebook.com/nawabig" })).toEqual({ facebook: "https://facebook.com/nawabig" });
  });
});

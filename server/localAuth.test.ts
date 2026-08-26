import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./localAuth";

describe("local authentication helpers", () => {
  it("normalizes email addresses for stable account lookup", () => {
    expect(normalizeEmail("  Developer@Example.COM ")).toBe("developer@example.com");
  });

  it("hashes passwords without storing the plaintext and verifies only the correct value", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(encoded).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
  });
});

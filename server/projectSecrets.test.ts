import { describe, expect, it } from "vitest";
import { decryptProjectSecret, encryptProjectSecret, isProjectVaultConfigured } from "./projectSecrets";

const testKey = Buffer.alloc(32, 23).toString("base64");

describe("project secret encryption", () => {
  it("encrypts values with unique IVs and can decrypt only with the correct key", () => {
    const one = encryptProjectSecret("super-secret-value", testKey);
    const two = encryptProjectSecret("super-secret-value", testKey);

    expect(one.ciphertext).not.toEqual("super-secret-value");
    expect(one.iv).not.toEqual(two.iv);
    expect(decryptProjectSecret(one, testKey)).toEqual("super-secret-value");
    expect(() => decryptProjectSecret(one, Buffer.alloc(32, 5).toString("base64"))).toThrow();
  });

  it("requires a Base64-encoded 32-byte key", () => {
    expect(isProjectVaultConfigured(testKey)).toBe(true);
    expect(isProjectVaultConfigured("invalid")).toBe(false);
  });
});

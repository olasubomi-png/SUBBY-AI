import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

export type EncryptedProjectSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function decodeKey(base64Key: string) {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("Project Vault is not configured with a valid 32-byte encryption key.");
  return key;
}

export function isProjectVaultConfigured(base64Key = process.env.PROJECT_SECRETS_ENCRYPTION_KEY ?? "") {
  try {
    decodeKey(base64Key);
    return true;
  } catch {
    return false;
  }
}

export function encryptProjectSecret(value: string, base64Key = process.env.PROJECT_SECRETS_ENCRYPTION_KEY ?? ""): EncryptedProjectSecret {
  const key = decodeKey(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

export function decryptProjectSecret(payload: EncryptedProjectSecret, base64Key = process.env.PROJECT_SECRETS_ENCRYPTION_KEY ?? "") {
  const key = decodeKey(base64Key);
  const decipher = createDecipheriv(algorithm, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

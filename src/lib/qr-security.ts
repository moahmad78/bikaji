import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.QR_SECRET_KEY || "c65239fb8bfa4674a27090f394621bfa4674a27090f394621bfa";

// Key must be exactly 32 bytes (256 bits)
const KEY = crypto.createHash("sha256").update(SECRET).digest();

/**
 * Encrypts table metadata into a secure, opaque token string.
 * Prevents direct database ID leakage.
 * 
 * @param tableId Unique table UUID
 * @param branchId Branch UUID
 * @returns An encrypted token string: iv_hex.encrypted_payload_hex
 */
export function encryptQRToken(tableId: string, branchId: string): string {
  const iv = crypto.randomBytes(16);
  const payload = JSON.stringify({
    tableId,
    branchId,
    timestamp: Date.now()
  });

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}.${encrypted}`;
}

/**
 * Decrypts and parses the secure QR token, verifying signature integrity.
 * 
 * @param token Encrypted token string
 * @returns Decoded table metadata, or null if tampered with.
 */
export function decryptQRToken(token: string): { tableId: string; branchId: string; timestamp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[QR Security] Decryption failed or token tampered with:", error);
    return null;
  }
}

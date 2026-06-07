import { safeStorage } from "electron";

const ENCRYPTED_PREFIX = "enc:";

/**
 * Wraps Electron's safeStorage (DPAPI on Windows) to encrypt/decrypt
 * sensitive strings before persisting them to disk.
 *
 * Encrypted values are stored as "enc:<base64>" so the reader can
 * distinguish them from legacy plaintext values and migrate gracefully.
 */
export class SecureStorageService {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encrypt(plaintext: string | null): string | null {
    if (plaintext == null || plaintext === "") return plaintext;
    if (!this.isAvailable()) return plaintext;
    const encrypted = safeStorage.encryptString(plaintext);
    return `${ENCRYPTED_PREFIX}${encrypted.toString("base64")}`;
  }

  decrypt(stored: string | null): string | null {
    if (stored == null || stored === "") return stored;
    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
      // Legacy plaintext value — return as-is for backward compatibility.
      return stored;
    }
    if (!this.isAvailable()) return stored;
    const base64 = stored.slice(ENCRYPTED_PREFIX.length);
    const buffer = Buffer.from(base64, "base64");
    return safeStorage.decryptString(buffer);
  }
}

// Encryption utilities for secure API key storage
export class CryptoService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;

  private static toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  private static fromBase64(value: string): Uint8Array {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error('Invalid encrypted data');
    }
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  /**
   * Generate a cryptographic key for encryption/decryption
   */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data (like API keys)
   */
  static async encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    // Generate a random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encodedData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return this.toBase64(combined);
  }

  /** Export a generated key into a storage-safe base64 string. */
  static async exportKey(key: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', key);
    return this.toBase64(new Uint8Array(raw));
  }

  /** Restore a storage-safe base64 key and reject malformed values early. */
  static async importKey(encodedKey: string): Promise<CryptoKey> {
    const raw = this.fromBase64(encodedKey);
    if (raw.length !== this.KEY_LENGTH / 8) throw new Error('Invalid encryption key');
    return crypto.subtle.importKey(
      'raw',
      raw.buffer as ArrayBuffer,
      { name: this.ALGORITHM },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Decrypt sensitive data
   */
  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    // Convert from base64
    const combined = this.fromBase64(encryptedData);
    if (combined.length < this.IV_LENGTH + 16) throw new Error('Invalid encrypted data');

    // Extract IV and encrypted data
    const iv = combined.slice(0, this.IV_LENGTH);
    const data = combined.slice(this.IV_LENGTH);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }
}

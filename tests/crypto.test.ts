import { CryptoService } from '../src/utils/crypto';

describe('CryptoService', () => {
  test('round-trips data through encrypt/decrypt', async () => {
    const key = await CryptoService.generateKey();
    const original = 'test-api-key-12345';

    const encrypted = await CryptoService.encrypt(original, key);
    const decrypted = await CryptoService.decrypt(encrypted, key);

    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  test('produces different ciphertext for identical input', async () => {
    const key = await CryptoService.generateKey();

    const first = await CryptoService.encrypt('same-input', key);
    const second = await CryptoService.encrypt('same-input', key);

    expect(first).not.toBe(second);
  });

  test('supports empty plaintext without weakening validation', async () => {
    const key = await CryptoService.generateKey();
    const encrypted = await CryptoService.encrypt('', key);

    await expect(CryptoService.decrypt(encrypted, key)).resolves.toBe('');
  });

  test('round-trips an exported key', async () => {
    const key = await CryptoService.generateKey();
    const encodedKey = await CryptoService.exportKey(key);
    const importedKey = await CryptoService.importKey(encodedKey);
    const encrypted = await CryptoService.encrypt('portable-secret', importedKey);

    await expect(CryptoService.decrypt(encrypted, key)).resolves.toBe('portable-secret');
  });

  test.each(['', 'not-base64', 'AAAA', '!!!!'])('rejects malformed ciphertext: %s', async value => {
    const key = await CryptoService.generateKey();

    await expect(CryptoService.decrypt(value, key)).rejects.toThrow('Invalid encrypted data');
  });

  test('rejects malformed exported keys', async () => {
    await expect(CryptoService.importKey('AAAA')).rejects.toThrow('Invalid encryption key');
  });
});

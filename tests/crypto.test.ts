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
});

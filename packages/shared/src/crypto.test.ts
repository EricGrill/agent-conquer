// packages/shared/src/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { generateKeyPair, sign, verify, KeyPair } from './crypto.js';

describe('crypto', () => {
  it('generates a valid key pair', () => {
    const keyPair = generateKeyPair();
    expect(keyPair.publicKey).toHaveLength(64); // hex encoded 32 bytes
    expect(keyPair.privateKey).toHaveLength(128); // hex encoded 64 bytes
  });

  it('signs and verifies a message', () => {
    const keyPair = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair.privateKey);

    expect(verify(message, signature, keyPair.publicKey)).toBe(true);
  });

  it('rejects invalid signatures', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair1.privateKey);

    // Verify with wrong public key should fail
    expect(verify(message, signature, keyPair2.publicKey)).toBe(false);
  });

  it('rejects tampered messages', () => {
    const keyPair = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair.privateKey);

    expect(verify('tampered message', signature, keyPair.publicKey)).toBe(false);
  });
});

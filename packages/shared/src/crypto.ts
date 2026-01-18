// packages/shared/src/crypto.ts
import nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: string;  // hex encoded
  privateKey: string; // hex encoded
}

/**
 * Generate an ed25519 key pair for signing messages
 */
export function generateKeyPair(): KeyPair {
  const pair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(pair.publicKey).toString('hex'),
    privateKey: Buffer.from(pair.secretKey).toString('hex')
  };
}

/**
 * Sign a message with a private key
 */
export function sign(message: string, privateKeyHex: string): string {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const messageBytes = Buffer.from(message, 'utf8');
  const signature = nacl.sign.detached(messageBytes, privateKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Verify a message signature with a public key
 */
export function verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');
    const messageBytes = Buffer.from(message, 'utf8');
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}

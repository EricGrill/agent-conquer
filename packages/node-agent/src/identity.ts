// packages/node-agent/src/identity.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { generateKeyPair, sign as cryptoSign } from '@agent-conquer/shared';

interface IdentityData {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export class Identity {
  readonly nodeId: string;
  readonly publicKey: string;
  private readonly privateKey: string;

  private constructor(data: IdentityData) {
    this.nodeId = data.nodeId;
    this.publicKey = data.publicKey;
    this.privateKey = data.privateKey;
  }

  /**
   * Load existing identity or create a new one
   */
  static loadOrCreate(dataDir: string): Identity {
    const identityPath = join(dataDir, 'identity.json');

    if (existsSync(identityPath)) {
      const data = JSON.parse(readFileSync(identityPath, 'utf-8')) as IdentityData;
      return new Identity(data);
    }

    // Create new identity
    mkdirSync(dataDir, { recursive: true });
    const keyPair = generateKeyPair();
    const data: IdentityData = {
      nodeId: randomUUID(),
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      createdAt: new Date().toISOString()
    };

    writeFileSync(identityPath, JSON.stringify(data, null, 2));
    return new Identity(data);
  }

  /**
   * Sign a message with this identity's private key
   */
  sign(message: string): string {
    return cryptoSign(message, this.privateKey);
  }
}

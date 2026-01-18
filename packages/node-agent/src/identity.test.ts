// packages/node-agent/src/identity.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Identity } from './identity.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './.test-identity';

describe('Identity', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('generates new identity on first load', () => {
    const identity = Identity.loadOrCreate(TEST_DIR);

    expect(identity.nodeId).toBeDefined();
    expect(identity.publicKey).toHaveLength(64);
    expect(existsSync(join(TEST_DIR, 'identity.json'))).toBe(true);
  });

  it('loads existing identity on subsequent loads', () => {
    const identity1 = Identity.loadOrCreate(TEST_DIR);
    const identity2 = Identity.loadOrCreate(TEST_DIR);

    expect(identity1.nodeId).toBe(identity2.nodeId);
    expect(identity1.publicKey).toBe(identity2.publicKey);
  });

  it('can sign messages', () => {
    const identity = Identity.loadOrCreate(TEST_DIR);
    const signature = identity.sign('test message');

    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
  });
});

// packages/shared/src/events.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createEvent, signEvent, verifyEvent, resetSequence } from './events.js';
import { generateKeyPair } from './crypto.js';

describe('events', () => {
  beforeEach(() => {
    resetSequence('node-1');
  });

  it('creates an event with required fields', () => {
    const event = createEvent('node.connected', 'node-1', { address: '100.64.0.1' });

    expect(event.eventId).toBeDefined();
    expect(event.type).toBe('node.connected');
    expect(event.nodeId).toBe('node-1');
    expect(event.payload).toEqual({ address: '100.64.0.1' });
    expect(event.timestamp).toBeDefined();
    expect(event.sequence).toBe(0);
    expect(event.signature).toBe('');
  });

  it('signs an event', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    expect(signedEvent.signature).not.toBe('');
    expect(signedEvent.signature.length).toBeGreaterThan(0);
  });

  it('verifies a valid signed event', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    expect(verifyEvent(signedEvent, keyPair.publicKey)).toBe(true);
  });

  it('rejects tampered events', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    // Tamper with the event
    signedEvent.nodeId = 'node-2';

    expect(verifyEvent(signedEvent, keyPair.publicKey)).toBe(false);
  });

  it('increments sequence numbers per node', () => {
    const event1 = createEvent('agent.started', 'node-1', {});
    const event2 = createEvent('agent.started', 'node-1', {});
    const event3 = createEvent('agent.started', 'node-1', {});

    expect(event1.sequence).toBe(0);
    expect(event2.sequence).toBe(1);
    expect(event3.sequence).toBe(2);
  });
});

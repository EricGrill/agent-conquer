// packages/shared/src/events.ts
import { randomUUID } from 'crypto';
import { sign, verify } from './crypto.js';

export type EventType =
  | 'node.connected'
  | 'node.disconnected'
  | 'node.heartbeat'
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.state_changed'
  | 'agent.error'
  | 'message.received'
  | 'message.sent'
  | 'command.received'
  | 'command.executed'
  | 'command.failed';

export interface Event {
  eventId: string;
  type: EventType;
  nodeId: string;
  agentId?: string;
  timestamp: string;
  sequence: number;
  payload: Record<string, unknown>;
  signature: string;
}

// Sequence counters per node (in-memory, reset on restart)
const sequenceCounters = new Map<string, number>();

/**
 * Create a new unsigned event
 */
export function createEvent(
  type: EventType,
  nodeId: string,
  payload: Record<string, unknown>,
  agentId?: string
): Event {
  const currentSeq = sequenceCounters.get(nodeId) ?? 0;
  sequenceCounters.set(nodeId, currentSeq + 1);

  return {
    eventId: randomUUID(),
    type,
    nodeId,
    agentId,
    timestamp: new Date().toISOString(),
    sequence: currentSeq,
    payload,
    signature: ''
  };
}

/**
 * Create the canonical string representation of an event for signing
 */
function eventToSignableString(event: Event): string {
  const { signature, ...rest } = event;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/**
 * Sign an event with a private key
 */
export function signEvent(event: Event, privateKey: string): Event {
  const signable = eventToSignableString(event);
  const signature = sign(signable, privateKey);
  return { ...event, signature };
}

/**
 * Verify an event's signature
 */
export function verifyEvent(event: Event, publicKey: string): boolean {
  const signable = eventToSignableString(event);
  return verify(signable, event.signature, publicKey);
}

/**
 * Reset sequence counter for a node (useful for testing)
 */
export function resetSequence(nodeId: string): void {
  sequenceCounters.delete(nodeId);
}

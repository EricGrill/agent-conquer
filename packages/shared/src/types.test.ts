// packages/shared/src/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Node, Agent, Message, Command } from './types.js';

describe('types', () => {
  it('Node type is correctly shaped', () => {
    const node: Node = {
      id: 'node-1',
      name: 'workstation',
      publicKey: 'abc123',
      address: '100.64.0.1',
      status: 'connected',
      lastHeartbeat: new Date().toISOString(),
      metrics: { cpu: 25, memory: 50, uptime: 3600 }
    };
    expect(node.status).toBe('connected');
  });

  it('Agent type is correctly shaped', () => {
    const agent: Agent = {
      id: 'agent-1',
      nodeId: 'node-1',
      name: 'claude-main',
      status: 'idle',
      currentTask: null,
      startedAt: new Date().toISOString(),
      pid: 12345
    };
    expect(agent.status).toBe('idle');
  });

  it('Message type is correctly shaped', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello',
      timestamp: new Date().toISOString()
    };
    expect(message.role).toBe('assistant');
  });

  it('Command type is correctly shaped', () => {
    const command: Command = {
      commandId: 'cmd-1',
      type: 'start_agent',
      targetNodeId: 'node-1',
      payload: { name: 'claude-main' },
      timestamp: new Date().toISOString(),
      signature: 'sig123'
    };
    expect(command.type).toBe('start_agent');
  });
});

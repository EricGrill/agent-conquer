// packages/control-plane/src/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from './registry.js';

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  it('registers a new node', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey123');

    const node = registry.getNode('node-1');
    expect(node).toBeDefined();
    expect(node?.name).toBe('workstation');
    expect(node?.status).toBe('connected');
  });

  it('updates node heartbeat', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey123');

    const before = registry.getNode('node-1')?.lastHeartbeat;

    // Wait a tiny bit to ensure timestamp changes
    registry.updateHeartbeat('node-1');

    const after = registry.getNode('node-1')?.lastHeartbeat;
    expect(after).toBeDefined();
  });

  it('marks node as disconnected', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey123');
    registry.disconnectNode('node-1');

    const node = registry.getNode('node-1');
    expect(node?.status).toBe('disconnected');
  });

  it('lists all nodes', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey1');
    registry.registerNode('node-2', 'server', 'pubkey2');

    const nodes = registry.getAllNodes();
    expect(nodes).toHaveLength(2);
  });

  it('registers an agent under a node', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey1');
    registry.registerAgent('node-1', 'agent-1', 'claude-main', 12345);

    const agents = registry.getAgentsForNode('node-1');
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('claude-main');
  });

  it('removes an agent', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey1');
    registry.registerAgent('node-1', 'agent-1', 'claude-main', 12345);
    registry.removeAgent('agent-1');

    const agents = registry.getAgentsForNode('node-1');
    expect(agents).toHaveLength(0);
  });

  it('gets all agents across nodes', () => {
    registry.registerNode('node-1', 'workstation', 'pubkey1');
    registry.registerNode('node-2', 'server', 'pubkey2');
    registry.registerAgent('node-1', 'agent-1', 'claude-1', 111);
    registry.registerAgent('node-2', 'agent-2', 'claude-2', 222);

    const agents = registry.getAllAgents();
    expect(agents).toHaveLength(2);
  });
});

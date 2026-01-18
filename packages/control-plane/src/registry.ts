// packages/control-plane/src/registry.ts
import type { Node, Agent, AgentStatus } from '@agent-conquer/shared';

interface RegisteredNode extends Node {
  agents: Map<string, Agent>;
}

export class NodeRegistry {
  private nodes: Map<string, RegisteredNode> = new Map();

  registerNode(nodeId: string, name: string, publicKey: string, address?: string): void {
    const existing = this.nodes.get(nodeId);

    if (existing) {
      // Update existing node
      existing.name = name;
      existing.status = 'connected';
      existing.lastHeartbeat = new Date().toISOString();
      if (address) existing.address = address;
    } else {
      // Create new node
      this.nodes.set(nodeId, {
        id: nodeId,
        name,
        publicKey,
        address: address ?? 'unknown',
        status: 'connected',
        lastHeartbeat: new Date().toISOString(),
        metrics: { cpu: 0, memory: 0, uptime: 0 },
        agents: new Map()
      });
    }
  }

  getNode(nodeId: string): Node | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const { agents, ...nodeData } = node;
    return nodeData;
  }

  getAllNodes(): Node[] {
    return Array.from(this.nodes.values()).map(({ agents, ...nodeData }) => nodeData);
  }

  updateHeartbeat(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date().toISOString();
      node.status = 'connected';
    }
  }

  updateMetrics(nodeId: string, metrics: Node['metrics']): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.metrics = metrics;
    }
  }

  disconnectNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'disconnected';
    }
  }

  registerAgent(nodeId: string, agentId: string, name: string, pid: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.agents.set(agentId, {
        id: agentId,
        nodeId,
        name,
        status: 'idle',
        currentTask: null,
        startedAt: new Date().toISOString(),
        pid
      });
    }
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    for (const node of this.nodes.values()) {
      const agent = node.agents.get(agentId);
      if (agent) {
        agent.status = status;
        break;
      }
    }
  }

  removeAgent(agentId: string): void {
    for (const node of this.nodes.values()) {
      if (node.agents.has(agentId)) {
        node.agents.delete(agentId);
        break;
      }
    }
  }

  getAgentsForNode(nodeId: string): Agent[] {
    const node = this.nodes.get(nodeId);
    return node ? Array.from(node.agents.values()) : [];
  }

  getAllAgents(): Agent[] {
    const agents: Agent[] = [];
    for (const node of this.nodes.values()) {
      agents.push(...node.agents.values());
    }
    return agents;
  }

  getAgent(agentId: string): Agent | undefined {
    for (const node of this.nodes.values()) {
      const agent = node.agents.get(agentId);
      if (agent) return agent;
    }
    return undefined;
  }

  getPublicKey(nodeId: string): string | undefined {
    return this.nodes.get(nodeId)?.publicKey;
  }
}

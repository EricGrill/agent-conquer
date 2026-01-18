// packages/dashboard/src/hooks/useControlPlane.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Node, Agent } from '@agent-conquer/shared';
import type { ControlPlaneState, DashboardEvent } from '../types';

const WS_URL = `ws://${window.location.hostname}:3000/ws/dashboard`;

export function useControlPlane() {
  const [state, setState] = useState<ControlPlaneState>({
    connected: false,
    nodes: new Map(),
    agents: new Map()
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const handleMessage = useCallback((message: DashboardEvent) => {
    switch (message.type) {
      case 'state.full':
        // Initial state sync
        {
          const nodes = new Map<string, Node>();
          const agents = new Map<string, Agent>();

          for (const node of (message.nodes as Node[])) {
            nodes.set(node.id, node);
          }
          for (const agent of (message.agents as Agent[])) {
            agents.set(agent.id, agent);
          }

          setState((prev) => ({ ...prev, nodes, agents }));
        }
        break;

      case 'node.connected':
        setState((prev) => {
          const nodes = new Map(prev.nodes);
          const nodeData = message as unknown as Node;
          nodes.set(nodeData.id, nodeData);
          return { ...prev, nodes };
        });
        break;

      case 'node.disconnected':
        setState((prev) => {
          const nodes = new Map(prev.nodes);
          const node = nodes.get(message.nodeId as string);
          if (node) {
            nodes.set(node.id, { ...node, status: 'disconnected' });
          }
          return { ...prev, nodes };
        });
        break;

      case 'agent.started':
        setState((prev) => {
          const agents = new Map(prev.agents);
          const payload = message.payload as { agentId: string; name: string; pid: number };
          agents.set(payload.agentId, {
            id: payload.agentId,
            nodeId: message.nodeId as string,
            name: payload.name,
            status: 'idle',
            currentTask: null,
            startedAt: new Date().toISOString(),
            pid: payload.pid
          });
          return { ...prev, agents };
        });
        break;

      case 'agent.stopped':
        setState((prev) => {
          const agents = new Map(prev.agents);
          const payload = message.payload as { agentId: string };
          agents.delete(payload.agentId);
          return { ...prev, agents };
        });
        break;

      case 'agent.state_changed':
        setState((prev) => {
          const agents = new Map(prev.agents);
          const payload = message.payload as { agentId: string; status: string };
          const agent = agents.get(payload.agentId);
          if (agent) {
            agents.set(agent.id, { ...agent, status: payload.status as Agent['status'] });
          }
          return { ...prev, agents };
        });
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
      console.log('Connected to Control Plane');
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      console.log('Disconnected from Control Plane');

      // Reconnect after delay
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DashboardEvent;
        handleMessage(data);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }, [handleMessage]);

  const sendCommand = useCallback((agentId: string, type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'command',
        agentId,
        type,
        payload
      }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    connected: state.connected,
    nodes: Array.from(state.nodes.values()),
    agents: Array.from(state.agents.values()),
    sendCommand
  };
}

// packages/dashboard/src/types.ts
import type { Node, Agent } from '@agent-conquer/shared';

export interface ControlPlaneState {
  connected: boolean;
  nodes: Map<string, Node>;
  agents: Map<string, Agent>;
}

export interface DashboardEvent {
  type: string;
  [key: string]: unknown;
}

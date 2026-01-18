// packages/shared/src/types.ts

// Node represents a machine running the Node Agent
export interface Node {
  id: string;
  name: string;
  publicKey: string;
  address: string;
  status: NodeStatus;
  lastHeartbeat: string; // ISO8601
  metrics: NodeMetrics;
}

export type NodeStatus = 'connected' | 'disconnected' | 'degraded';

export interface NodeMetrics {
  cpu: number;      // 0-100 percentage
  memory: number;   // 0-100 percentage
  uptime: number;   // seconds
}

// Agent represents a Claude Code instance
export interface Agent {
  id: string;
  nodeId: string;
  name: string;
  status: AgentStatus;
  currentTask: string | null;
  startedAt: string; // ISO8601
  pid: number;
}

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'paused' | 'error';

// Message in a conversation
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO8601
  toolCalls?: ToolCall[];
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

// Conversation history for an agent
export interface Conversation {
  agentId: string;
  messages: Message[];
}

// Commands sent from Control Plane to Node Agent
export interface Command {
  commandId: string;
  type: CommandType;
  targetNodeId: string;
  targetAgentId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

export type CommandType =
  | 'start_agent'
  | 'stop_agent'
  | 'pause_agent'
  | 'resume_agent'
  | 'restart_agent'
  | 'send_message'
  | 'inject_system_message'
  | 'clear_context'
  | 'clear_history';

// Command acknowledgment
export interface CommandAck {
  commandId: string;
  status: 'accepted' | 'executing' | 'completed' | 'failed';
  error?: string;
  timestamp: string;
}

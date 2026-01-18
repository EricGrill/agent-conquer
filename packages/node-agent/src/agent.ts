// packages/node-agent/src/agent.ts
import { EventEmitter } from 'events';
import { Identity } from './identity.js';
import { Connection } from './connection.js';
import { ProcessWrapper } from './process-wrapper.js';
import { createEvent, signEvent } from '@agent-conquer/shared';
import type { Agent, AgentStatus, Command, CommandAck, EventType } from '@agent-conquer/shared';

interface AgentProcess {
  id: string;
  name: string;
  process: ProcessWrapper;
  status: AgentStatus;
  outputBuffer: string[];
  startedAt: string;
}

interface NodeAgentOptions {
  serverUrl: string;
  nodeName: string;
  dataDir: string;
}

export class NodeAgent extends EventEmitter {
  private identity: Identity;
  private connection: Connection;
  private agents: Map<string, AgentProcess> = new Map();
  private nodeName: string;

  constructor(options: NodeAgentOptions) {
    super();
    this.identity = Identity.loadOrCreate(options.dataDir);
    this.nodeName = options.nodeName;
    this.connection = new Connection(options.serverUrl);

    this.setupConnectionHandlers();
  }

  get nodeId(): string {
    return this.identity.nodeId;
  }

  private setupConnectionHandlers(): void {
    this.connection.onStateChange((state) => {
      console.log(`Connection state: ${state}`);
      if (state === 'connected') {
        this.sendRegistration();
      }
    });

    this.connection.onMessage((message) => {
      this.handleMessage(message);
    });
  }

  private sendRegistration(): void {
    const event = createEvent('node.connected', this.identity.nodeId, {
      name: this.nodeName,
      publicKey: this.identity.publicKey
    });
    const signed = signEvent(event, this.identity.sign(JSON.stringify(event)));
    this.connection.send(JSON.stringify(signed));
  }

  private handleMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      if (data.commandId) {
        this.handleCommand(data as Command);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleCommand(command: Command): void {
    console.log(`Received command: ${command.type}`);

    // Send acknowledgment
    this.sendCommandAck(command.commandId, 'accepted');

    try {
      switch (command.type) {
        case 'start_agent':
          this.startAgent(command);
          break;
        case 'stop_agent':
          this.stopAgent(command);
          break;
        case 'pause_agent':
          this.pauseAgent(command);
          break;
        case 'resume_agent':
          this.resumeAgent(command);
          break;
        case 'send_message':
          this.sendMessageToAgent(command);
          break;
        default:
          console.log(`Unknown command type: ${command.type}`);
      }
      this.sendCommandAck(command.commandId, 'completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendCommandAck(command.commandId, 'failed', errorMessage);
    }
  }

  private sendCommandAck(commandId: string, status: CommandAck['status'], error?: string): void {
    const ack: CommandAck = {
      commandId,
      status,
      error,
      timestamp: new Date().toISOString()
    };
    this.connection.send(JSON.stringify(ack));
  }

  private startAgent(command: Command): void {
    const { name, workingDir } = command.payload as { name: string; workingDir?: string };
    const agentId = `agent-${Date.now()}`;

    const proc = new ProcessWrapper('claude', [], workingDir);

    const agent: AgentProcess = {
      id: agentId,
      name,
      process: proc,
      status: 'idle',
      outputBuffer: [],
      startedAt: new Date().toISOString()
    };

    proc.onData((data) => {
      agent.outputBuffer.push(data);
      // Keep buffer limited
      if (agent.outputBuffer.length > 1000) {
        agent.outputBuffer.shift();
      }
      this.emitEvent('message.received', { agentId, content: data });
    });

    proc.onExit((code) => {
      this.emitEvent('agent.stopped', { agentId, exitCode: code });
      this.agents.delete(agentId);
    });

    this.agents.set(agentId, agent);
    this.emitEvent('agent.started', { agentId, name, pid: proc.pid });
  }

  private stopAgent(command: Command): void {
    const { agentId } = command.payload as { agentId: string };
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.process.kill();
    }
  }

  private pauseAgent(command: Command): void {
    const { agentId } = command.payload as { agentId: string };
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.process.pause();
      agent.status = 'paused';
      this.emitEvent('agent.state_changed', { agentId, status: 'paused' });
    }
  }

  private resumeAgent(command: Command): void {
    const { agentId } = command.payload as { agentId: string };
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.process.resume();
      agent.status = 'idle';
      this.emitEvent('agent.state_changed', { agentId, status: 'idle' });
    }
  }

  private sendMessageToAgent(command: Command): void {
    const { agentId, message } = command.payload as { agentId: string; message: string };
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.process.write(message + '\n');
      this.emitEvent('message.sent', { agentId, content: message });
    }
  }

  private emitEvent(type: EventType, payload: Record<string, unknown>): void {
    const event = createEvent(type, this.identity.nodeId, payload);
    const signed = signEvent(event, this.identity.sign(JSON.stringify(event)));
    this.connection.send(JSON.stringify(signed));
  }

  start(): void {
    console.log(`Starting Node Agent "${this.nodeName}" (${this.identity.nodeId})`);
    this.connection.connect();
  }

  stop(): void {
    console.log('Stopping Node Agent...');
    for (const agent of this.agents.values()) {
      agent.process.kill();
    }
    this.connection.disconnect();
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      nodeId: this.identity.nodeId,
      name: a.name,
      status: a.status,
      currentTask: null,
      startedAt: a.startedAt,
      pid: a.process.pid
    }));
  }
}

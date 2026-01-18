// packages/control-plane/src/server.ts
import express, { Express, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import cors from 'cors';
import { NodeRegistry } from './registry.js';
import { CommandRouter } from './commands.js';
import { verifyEvent } from '@agent-conquer/shared';
import type { Event, CommandAck, CommandType, AgentStatus } from '@agent-conquer/shared';

interface ControlPlaneOptions {
  port: number;
  host: string;
  dataDir: string;
}

export class ControlPlane {
  private app: Express;
  private server: Server;
  private wss: WebSocketServer;
  private registry: NodeRegistry;
  private router: CommandRouter;
  private dashboardClients: Set<WebSocket> = new Set();

  constructor(options: ControlPlaneOptions) {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.registry = new NodeRegistry();
    this.router = new CommandRouter();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // List all nodes
    this.app.get('/api/nodes', (_req: Request, res: Response) => {
      res.json(this.registry.getAllNodes());
    });

    // List all agents
    this.app.get('/api/agents', (_req: Request, res: Response) => {
      res.json(this.registry.getAllAgents());
    });

    // Get specific agent
    this.app.get('/api/agents/:id', (req: Request, res: Response) => {
      const agent = this.registry.getAgent(req.params.id);
      if (agent) {
        res.json(agent);
      } else {
        res.status(404).json({ error: 'Agent not found' });
      }
    });

    // Send command to agent
    this.app.post('/api/agents/:id/command', (req: Request, res: Response) => {
      const agent = this.registry.getAgent(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const { type, payload } = req.body as { type: CommandType; payload: Record<string, unknown> };
      const command = this.router.createCommand(type, agent.nodeId, payload, agent.id);
      const sent = this.router.routeCommand(command);

      res.json({
        commandId: command.commandId,
        queued: !sent
      });
    });

    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const path = url.pathname;

      if (path === '/ws/node') {
        this.handleNodeConnection(ws);
      } else if (path === '/ws/dashboard') {
        this.handleDashboardConnection(ws);
      } else {
        ws.close(4000, 'Unknown path');
      }
    });
  }

  private handleNodeConnection(ws: WebSocket): void {
    let nodeId: string | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle events from nodes
        if (message.eventId) {
          const event = message as Event;

          // First message should be node.connected with registration
          if (event.type === 'node.connected' && !nodeId) {
            nodeId = event.nodeId;
            const { name, publicKey } = event.payload as { name: string; publicKey: string };

            this.registry.registerNode(nodeId, name, publicKey);
            this.router.registerNodeConnection(nodeId, (msg) => ws.send(msg));

            console.log(`Node connected: ${name} (${nodeId})`);
          }

          // Verify signature for subsequent events
          if (nodeId) {
            const publicKey = this.registry.getPublicKey(nodeId);
            if (publicKey && !verifyEvent(event, publicKey)) {
              console.warn(`Invalid signature from node ${nodeId}`);
              return;
            }
          }

          // Process event
          this.processEvent(event);

          // Broadcast to dashboards
          this.broadcastToDashboards(event);
        }

        // Handle command acknowledgments
        if (message.commandId && message.status) {
          const ack = message as CommandAck;
          if (ack.status === 'completed' || ack.status === 'failed') {
            this.router.completeCommand(ack.commandId);
          }
          this.broadcastToDashboards(ack);
        }
      } catch (error) {
        console.error('Failed to process message:', error);
      }
    });

    ws.on('close', () => {
      if (nodeId) {
        console.log(`Node disconnected: ${nodeId}`);
        this.registry.disconnectNode(nodeId);
        this.router.unregisterNodeConnection(nodeId);

        this.broadcastToDashboards({
          type: 'node.disconnected',
          nodeId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private handleDashboardConnection(ws: WebSocket): void {
    this.dashboardClients.add(ws);

    // Send current state
    ws.send(JSON.stringify({
      type: 'state.full',
      nodes: this.registry.getAllNodes(),
      agents: this.registry.getAllAgents()
    }));

    ws.on('close', () => {
      this.dashboardClients.delete(ws);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle commands from dashboard
        if (message.action === 'command') {
          const { agentId, type, payload } = message;
          const agent = this.registry.getAgent(agentId);

          if (agent) {
            const command = this.router.createCommand(type, agent.nodeId, payload, agentId);
            this.router.routeCommand(command);
          }
        }
      } catch (error) {
        console.error('Failed to process dashboard message:', error);
      }
    });
  }

  private processEvent(event: Event): void {
    switch (event.type) {
      case 'node.heartbeat':
        this.registry.updateHeartbeat(event.nodeId);
        break;
      case 'agent.started': {
        const startPayload = event.payload as { agentId: string; name: string; pid: number };
        this.registry.registerAgent(event.nodeId, startPayload.agentId, startPayload.name, startPayload.pid);
        break;
      }
      case 'agent.stopped': {
        const stopPayload = event.payload as { agentId: string };
        this.registry.removeAgent(stopPayload.agentId);
        break;
      }
      case 'agent.state_changed': {
        const statePayload = event.payload as { agentId: string; status: string };
        this.registry.updateAgentStatus(statePayload.agentId, statePayload.status as AgentStatus);
        break;
      }
    }
  }

  private broadcastToDashboards(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.dashboardClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  start(port: number, host: string = '0.0.0.0'): void {
    this.server.listen(port, host, () => {
      console.log(`Control Plane running on ${host}:${port}`);
      console.log(`  API: http://${host}:${port}/api`);
      console.log(`  Node WS: ws://${host}:${port}/ws/node`);
      console.log(`  Dashboard WS: ws://${host}:${port}/ws/dashboard`);
    });
  }

  stop(): void {
    this.wss.close();
    this.server.close();
  }
}

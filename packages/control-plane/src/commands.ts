// packages/control-plane/src/commands.ts
import { randomUUID } from 'crypto';
import type { Command, CommandType } from '@agent-conquer/shared';

type SendFunction = (message: string) => void;

export class CommandRouter {
  private nodeConnections: Map<string, SendFunction> = new Map();
  private commandQueue: Map<string, Command[]> = new Map();
  private pendingCommands: Map<string, Command> = new Map();

  /**
   * Register a node's send function for routing commands
   */
  registerNodeConnection(nodeId: string, send: SendFunction): void {
    this.nodeConnections.set(nodeId, send);

    // Flush any queued commands
    const queued = this.commandQueue.get(nodeId) ?? [];
    for (const command of queued) {
      send(JSON.stringify(command));
    }
    this.commandQueue.delete(nodeId);
  }

  /**
   * Remove a node's connection
   */
  unregisterNodeConnection(nodeId: string): void {
    this.nodeConnections.delete(nodeId);
  }

  /**
   * Create a new command
   */
  createCommand(
    type: CommandType,
    targetNodeId: string,
    payload: Record<string, unknown>,
    targetAgentId?: string
  ): Command {
    const command: Command = {
      commandId: randomUUID(),
      type,
      targetNodeId,
      targetAgentId,
      payload,
      timestamp: new Date().toISOString(),
      signature: '' // Will be signed by control plane
    };

    this.pendingCommands.set(command.commandId, command);
    return command;
  }

  /**
   * Route a command to its target node
   */
  routeCommand(command: Command): boolean {
    const send = this.nodeConnections.get(command.targetNodeId);

    if (send) {
      send(JSON.stringify(command));
      return true;
    } else {
      // Queue for later
      const queue = this.commandQueue.get(command.targetNodeId) ?? [];
      queue.push(command);
      this.commandQueue.set(command.targetNodeId, queue);
      return false;
    }
  }

  /**
   * Get pending command by ID
   */
  getPendingCommand(commandId: string): Command | undefined {
    return this.pendingCommands.get(commandId);
  }

  /**
   * Mark command as completed
   */
  completeCommand(commandId: string): void {
    this.pendingCommands.delete(commandId);
  }

  /**
   * Get queued commands for a node (for testing)
   */
  getQueuedCommands(nodeId: string): Command[] {
    return this.commandQueue.get(nodeId) ?? [];
  }

  /**
   * Check if a node is connected
   */
  isNodeConnected(nodeId: string): boolean {
    return this.nodeConnections.has(nodeId);
  }
}

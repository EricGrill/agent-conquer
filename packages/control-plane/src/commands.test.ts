// packages/control-plane/src/commands.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRouter } from './commands.js';

describe('CommandRouter', () => {
  let router: CommandRouter;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    router = new CommandRouter();
    mockSend = vi.fn();
  });

  it('creates a command with proper structure', () => {
    const command = router.createCommand('start_agent', 'node-1', {
      name: 'claude-main'
    });

    expect(command.commandId).toBeDefined();
    expect(command.type).toBe('start_agent');
    expect(command.targetNodeId).toBe('node-1');
    expect(command.payload).toEqual({ name: 'claude-main' });
    expect(command.timestamp).toBeDefined();
  });

  it('routes command to correct node', () => {
    router.registerNodeConnection('node-1', mockSend);

    const command = router.createCommand('start_agent', 'node-1', {});
    router.routeCommand(command);

    expect(mockSend).toHaveBeenCalledWith(JSON.stringify(command));
  });

  it('queues command when node is disconnected', () => {
    const command = router.createCommand('start_agent', 'node-1', {});
    router.routeCommand(command);

    // Command should be queued, not sent
    expect(mockSend).not.toHaveBeenCalled();
    expect(router.getQueuedCommands('node-1')).toHaveLength(1);
  });

  it('flushes queued commands on reconnect', () => {
    const command = router.createCommand('start_agent', 'node-1', {});
    router.routeCommand(command);

    // Node reconnects
    router.registerNodeConnection('node-1', mockSend);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(router.getQueuedCommands('node-1')).toHaveLength(0);
  });

  it('tracks pending commands', () => {
    const command = router.createCommand('start_agent', 'node-1', {});

    expect(router.getPendingCommand(command.commandId)).toBeDefined();
  });

  it('completes pending commands', () => {
    const command = router.createCommand('start_agent', 'node-1', {});
    router.completeCommand(command.commandId);

    expect(router.getPendingCommand(command.commandId)).toBeUndefined();
  });

  it('checks node connection status', () => {
    expect(router.isNodeConnected('node-1')).toBe(false);

    router.registerNodeConnection('node-1', mockSend);
    expect(router.isNodeConnected('node-1')).toBe(true);

    router.unregisterNodeConnection('node-1');
    expect(router.isNodeConnected('node-1')).toBe(false);
  });
});

// packages/node-agent/src/connection.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { Connection } from './connection.js';

describe('Connection', () => {
  let server: WebSocketServer;
  let serverPort: number;

  beforeAll(async () => {
    server = new WebSocketServer({ port: 0 });
    serverPort = (server.address() as { port: number }).port;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // Clear all listeners between tests
    server.removeAllListeners('connection');
  });

  it('connects to server', async () => {
    const connection = new Connection(`ws://localhost:${serverPort}`);

    await new Promise<void>((resolve) => {
      connection.onStateChange((state) => {
        if (state === 'connected') {
          resolve();
        }
      });
      connection.connect();
    });

    expect(connection.state).toBe('connected');
    connection.disconnect();
  });

  it('sends and receives messages', async () => {
    // Set up server to echo messages
    server.on('connection', (ws) => {
      ws.on('message', (data) => {
        ws.send(data.toString());
      });
    });

    const connection = new Connection(`ws://localhost:${serverPort}`);

    const received = await new Promise<string>((resolve) => {
      connection.onMessage((msg) => {
        resolve(msg);
      });
      connection.onStateChange((state) => {
        if (state === 'connected') {
          connection.send('test message');
        }
      });
      connection.connect();
    });

    expect(received).toBe('test message');
    connection.disconnect();
  });

  it('reconnects on disconnect', async () => {
    const connection = new Connection(`ws://localhost:${serverPort}`, {
      reconnectDelay: 50,
      maxReconnectDelay: 100
    });

    let connectCount = 0;

    await new Promise<void>((resolve) => {
      connection.onStateChange((state) => {
        if (state === 'connected') {
          connectCount++;
          if (connectCount === 1) {
            // Force disconnect from server side
            server.clients.forEach((client) => client.close());
          }
          if (connectCount === 2) {
            resolve();
          }
        }
      });
      connection.connect();
    });

    expect(connectCount).toBe(2);
    connection.disconnect();
  });
});

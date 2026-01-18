# Agent Conquer v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal control plane for managing Claude Code agents across 2-5 machines with real-time visualization.

**Architecture:** Monorepo with three packages: node-agent (process wrapper using node-pty), control-plane (Express + WebSocket + Redis), dashboard (React + PixiJS). Communication via signed WebSocket messages.

**Tech Stack:** Node.js, TypeScript, node-pty, ws, Express, Redis, React, PixiJS, tweetnacl (ed25519)

---

## Phase 1: Project Foundation

### Task 1.1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: Create root package.json**

```json
{
  "name": "agent-conquer",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint packages/*/src/**/*.ts"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "vitest": "^1.0.0"
  }
}
```

**Step 2: Create base TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

**Step 3: Create shared package structure**

Create `packages/shared/package.json`:
```json
{
  "name": "@agent-conquer/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```

Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

Create `packages/shared/src/index.ts`:
```typescript
// Shared types and utilities for Agent Conquer
export * from './types.js';
export * from './crypto.js';
export * from './events.js';
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, node_modules created

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo structure with shared package"
```

---

### Task 1.2: Define Core Types

**Files:**
- Create: `packages/shared/src/types.ts`
- Test: `packages/shared/src/types.test.ts`

**Step 1: Write the types file**

```typescript
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
```

**Step 2: Write a simple type test**

```typescript
// packages/shared/src/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Node, Agent, Message, Command } from './types.js';

describe('types', () => {
  it('Node type is correctly shaped', () => {
    const node: Node = {
      id: 'node-1',
      name: 'workstation',
      publicKey: 'abc123',
      address: '100.64.0.1',
      status: 'connected',
      lastHeartbeat: new Date().toISOString(),
      metrics: { cpu: 25, memory: 50, uptime: 3600 }
    };
    expect(node.status).toBe('connected');
  });

  it('Agent type is correctly shaped', () => {
    const agent: Agent = {
      id: 'agent-1',
      nodeId: 'node-1',
      name: 'claude-main',
      status: 'idle',
      currentTask: null,
      startedAt: new Date().toISOString(),
      pid: 12345
    };
    expect(agent.status).toBe('idle');
  });

  it('Message type is correctly shaped', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello',
      timestamp: new Date().toISOString()
    };
    expect(message.role).toBe('assistant');
  });

  it('Command type is correctly shaped', () => {
    const command: Command = {
      commandId: 'cmd-1',
      type: 'start_agent',
      targetNodeId: 'node-1',
      payload: { name: 'claude-main' },
      timestamp: new Date().toISOString(),
      signature: 'sig123'
    };
    expect(command.type).toBe('start_agent');
  });
});
```

**Step 3: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(shared): add core type definitions"
```

---

### Task 1.3: Implement Crypto Utilities

**Files:**
- Create: `packages/shared/src/crypto.ts`
- Test: `packages/shared/src/crypto.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/shared/src/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { generateKeyPair, sign, verify, KeyPair } from './crypto.js';

describe('crypto', () => {
  it('generates a valid key pair', () => {
    const keyPair = generateKeyPair();
    expect(keyPair.publicKey).toHaveLength(64); // hex encoded 32 bytes
    expect(keyPair.privateKey).toHaveLength(128); // hex encoded 64 bytes
  });

  it('signs and verifies a message', () => {
    const keyPair = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair.privateKey);

    expect(verify(message, signature, keyPair.publicKey)).toBe(true);
  });

  it('rejects invalid signatures', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair1.privateKey);

    // Verify with wrong public key should fail
    expect(verify(message, signature, keyPair2.publicKey)).toBe(false);
  });

  it('rejects tampered messages', () => {
    const keyPair = generateKeyPair();
    const message = 'test message';
    const signature = sign(message, keyPair.privateKey);

    expect(verify('tampered message', signature, keyPair.publicKey)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL - module not found

**Step 3: Add tweetnacl dependency**

```bash
cd packages/shared && npm install tweetnacl && npm install -D @types/tweetnacl
```

**Step 4: Implement crypto module**

```typescript
// packages/shared/src/crypto.ts
import nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: string;  // hex encoded
  privateKey: string; // hex encoded
}

/**
 * Generate an ed25519 key pair for signing messages
 */
export function generateKeyPair(): KeyPair {
  const pair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(pair.publicKey).toString('hex'),
    privateKey: Buffer.from(pair.secretKey).toString('hex')
  };
}

/**
 * Sign a message with a private key
 */
export function sign(message: string, privateKeyHex: string): string {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const messageBytes = Buffer.from(message, 'utf8');
  const signature = nacl.sign.detached(messageBytes, privateKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Verify a message signature with a public key
 */
export function verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');
    const messageBytes = Buffer.from(message, 'utf8');
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}
```

**Step 5: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): add ed25519 crypto utilities"
```

---

### Task 1.4: Implement Event System

**Files:**
- Create: `packages/shared/src/events.ts`
- Test: `packages/shared/src/events.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/shared/src/events.test.ts
import { describe, it, expect } from 'vitest';
import { createEvent, signEvent, verifyEvent, Event, EventType } from './events.js';
import { generateKeyPair } from './crypto.js';

describe('events', () => {
  it('creates an event with required fields', () => {
    const event = createEvent('node.connected', 'node-1', { address: '100.64.0.1' });

    expect(event.eventId).toBeDefined();
    expect(event.type).toBe('node.connected');
    expect(event.nodeId).toBe('node-1');
    expect(event.payload).toEqual({ address: '100.64.0.1' });
    expect(event.timestamp).toBeDefined();
    expect(event.sequence).toBe(0);
    expect(event.signature).toBe('');
  });

  it('signs an event', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    expect(signedEvent.signature).not.toBe('');
    expect(signedEvent.signature.length).toBeGreaterThan(0);
  });

  it('verifies a valid signed event', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    expect(verifyEvent(signedEvent, keyPair.publicKey)).toBe(true);
  });

  it('rejects tampered events', () => {
    const keyPair = generateKeyPair();
    const event = createEvent('agent.started', 'node-1', { agentId: 'agent-1' });
    const signedEvent = signEvent(event, keyPair.privateKey);

    // Tamper with the event
    signedEvent.nodeId = 'node-2';

    expect(verifyEvent(signedEvent, keyPair.publicKey)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement events module**

```typescript
// packages/shared/src/events.ts
import { randomUUID } from 'crypto';
import { sign, verify } from './crypto.js';

export type EventType =
  | 'node.connected'
  | 'node.disconnected'
  | 'node.heartbeat'
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.state_changed'
  | 'agent.error'
  | 'message.received'
  | 'message.sent'
  | 'command.received'
  | 'command.executed'
  | 'command.failed';

export interface Event {
  eventId: string;
  type: EventType;
  nodeId: string;
  agentId?: string;
  timestamp: string;
  sequence: number;
  payload: Record<string, unknown>;
  signature: string;
}

// Sequence counters per node (in-memory, reset on restart)
const sequenceCounters = new Map<string, number>();

/**
 * Create a new unsigned event
 */
export function createEvent(
  type: EventType,
  nodeId: string,
  payload: Record<string, unknown>,
  agentId?: string
): Event {
  const currentSeq = sequenceCounters.get(nodeId) ?? 0;
  sequenceCounters.set(nodeId, currentSeq + 1);

  return {
    eventId: randomUUID(),
    type,
    nodeId,
    agentId,
    timestamp: new Date().toISOString(),
    sequence: currentSeq,
    payload,
    signature: ''
  };
}

/**
 * Create the canonical string representation of an event for signing
 */
function eventToSignableString(event: Event): string {
  const { signature, ...rest } = event;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/**
 * Sign an event with a private key
 */
export function signEvent(event: Event, privateKey: string): Event {
  const signable = eventToSignableString(event);
  const signature = sign(signable, privateKey);
  return { ...event, signature };
}

/**
 * Verify an event's signature
 */
export function verifyEvent(event: Event, publicKey: string): boolean {
  const signable = eventToSignableString(event);
  return verify(signable, event.signature, publicKey);
}

/**
 * Reset sequence counter for a node (useful for testing)
 */
export function resetSequence(nodeId: string): void {
  sequenceCounters.delete(nodeId);
}
```

**Step 4: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(shared): add event creation and verification"
```

---

## Phase 2: Node Agent Core

### Task 2.1: Initialize Node Agent Package

**Files:**
- Create: `packages/node-agent/package.json`
- Create: `packages/node-agent/tsconfig.json`
- Create: `packages/node-agent/src/index.ts`
- Create: `packages/node-agent/src/cli.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-conquer/node-agent",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "agent-conquer-node": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "@agent-conquer/shared": "workspace:*",
    "node-pty": "^1.0.0",
    "ws": "^8.14.0",
    "commander": "^11.1.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create entry point**

```typescript
// packages/node-agent/src/index.ts
export { NodeAgent } from './agent.js';
export { Identity } from './identity.js';
export { ProcessWrapper } from './process-wrapper.js';
```

**Step 4: Create CLI skeleton**

```typescript
// packages/node-agent/src/cli.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('agent-conquer-node')
  .description('Node Agent for Agent Conquer control plane')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to the control plane')
  .requiredOption('--server <url>', 'Control plane WebSocket URL')
  .option('--name <name>', 'Node name', 'unnamed-node')
  .option('--data-dir <path>', 'Data directory', './.agent-conquer')
  .action(async (options) => {
    console.log(`Connecting to ${options.server} as "${options.name}"...`);
    // Implementation will come in later tasks
  });

program.parse();
```

**Step 5: Install dependencies**

Run: `cd packages/node-agent && npm install`
Expected: Dependencies installed

**Step 6: Build and verify**

Run: `cd packages/node-agent && npm run build`
Expected: Build succeeds, dist/ created

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(node-agent): initialize package with CLI skeleton"
```

---

### Task 2.2: Implement Identity Management

**Files:**
- Create: `packages/node-agent/src/identity.ts`
- Test: `packages/node-agent/src/identity.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/node-agent/src/identity.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Identity } from './identity.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './.test-identity';

describe('Identity', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('generates new identity on first load', () => {
    const identity = Identity.loadOrCreate(TEST_DIR);

    expect(identity.nodeId).toBeDefined();
    expect(identity.publicKey).toHaveLength(64);
    expect(existsSync(join(TEST_DIR, 'identity.json'))).toBe(true);
  });

  it('loads existing identity on subsequent loads', () => {
    const identity1 = Identity.loadOrCreate(TEST_DIR);
    const identity2 = Identity.loadOrCreate(TEST_DIR);

    expect(identity1.nodeId).toBe(identity2.nodeId);
    expect(identity1.publicKey).toBe(identity2.publicKey);
  });

  it('can sign messages', () => {
    const identity = Identity.loadOrCreate(TEST_DIR);
    const signature = identity.sign('test message');

    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/node-agent && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement Identity class**

```typescript
// packages/node-agent/src/identity.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { generateKeyPair, sign as cryptoSign, KeyPair } from '@agent-conquer/shared';

interface IdentityData {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export class Identity {
  readonly nodeId: string;
  readonly publicKey: string;
  private readonly privateKey: string;

  private constructor(data: IdentityData) {
    this.nodeId = data.nodeId;
    this.publicKey = data.publicKey;
    this.privateKey = data.privateKey;
  }

  /**
   * Load existing identity or create a new one
   */
  static loadOrCreate(dataDir: string): Identity {
    const identityPath = join(dataDir, 'identity.json');

    if (existsSync(identityPath)) {
      const data = JSON.parse(readFileSync(identityPath, 'utf-8')) as IdentityData;
      return new Identity(data);
    }

    // Create new identity
    mkdirSync(dataDir, { recursive: true });
    const keyPair = generateKeyPair();
    const data: IdentityData = {
      nodeId: randomUUID(),
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      createdAt: new Date().toISOString()
    };

    writeFileSync(identityPath, JSON.stringify(data, null, 2));
    return new Identity(data);
  }

  /**
   * Sign a message with this identity's private key
   */
  sign(message: string): string {
    return cryptoSign(message, this.privateKey);
  }
}
```

**Step 4: Run tests**

Run: `cd packages/node-agent && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(node-agent): implement identity persistence"
```

---

### Task 2.3: Implement Process Wrapper

**Files:**
- Create: `packages/node-agent/src/process-wrapper.ts`
- Test: `packages/node-agent/src/process-wrapper.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/node-agent/src/process-wrapper.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { ProcessWrapper } from './process-wrapper.js';

describe('ProcessWrapper', () => {
  let wrapper: ProcessWrapper | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.kill();
      wrapper = null;
    }
  });

  it('spawns a process and captures output', async () => {
    wrapper = new ProcessWrapper('echo', ['hello world']);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      wrapper!.onData((chunk) => {
        data += chunk;
      });
      wrapper!.onExit(() => {
        resolve(data);
      });
    });

    expect(output.trim()).toBe('hello world');
  });

  it('writes to stdin', async () => {
    wrapper = new ProcessWrapper('cat', []);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      wrapper!.onData((chunk) => {
        data += chunk;
      });

      wrapper!.write('test input\n');

      // Give it time to process
      setTimeout(() => {
        wrapper!.kill();
        resolve(data);
      }, 100);
    });

    expect(output).toContain('test input');
  });

  it('reports process ID', () => {
    wrapper = new ProcessWrapper('sleep', ['10']);
    expect(wrapper.pid).toBeGreaterThan(0);
  });

  it('can pause and resume process', async () => {
    wrapper = new ProcessWrapper('sleep', ['10']);
    const pid = wrapper.pid;

    wrapper.pause();
    expect(wrapper.isPaused).toBe(true);

    wrapper.resume();
    expect(wrapper.isPaused).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/node-agent && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement ProcessWrapper**

```typescript
// packages/node-agent/src/process-wrapper.ts
import * as pty from 'node-pty';
import { EventEmitter } from 'events';

type DataCallback = (data: string) => void;
type ExitCallback = (code: number) => void;

export class ProcessWrapper extends EventEmitter {
  private ptyProcess: pty.IPty;
  private _isPaused: boolean = false;
  private dataCallbacks: DataCallback[] = [];
  private exitCallbacks: ExitCallback[] = [];

  constructor(command: string, args: string[], cwd?: string) {
    super();

    this.ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: cwd ?? process.cwd(),
      env: process.env as { [key: string]: string }
    });

    this.ptyProcess.onData((data) => {
      for (const cb of this.dataCallbacks) {
        cb(data);
      }
      this.emit('data', data);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      for (const cb of this.exitCallbacks) {
        cb(exitCode);
      }
      this.emit('exit', exitCode);
    });
  }

  get pid(): number {
    return this.ptyProcess.pid;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Register a callback for data output
   */
  onData(callback: DataCallback): void {
    this.dataCallbacks.push(callback);
  }

  /**
   * Register a callback for process exit
   */
  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback);
  }

  /**
   * Write to the process stdin
   */
  write(data: string): void {
    this.ptyProcess.write(data);
  }

  /**
   * Pause the process (SIGSTOP)
   */
  pause(): void {
    if (!this._isPaused) {
      process.kill(this.pid, 'SIGSTOP');
      this._isPaused = true;
    }
  }

  /**
   * Resume the process (SIGCONT)
   */
  resume(): void {
    if (this._isPaused) {
      process.kill(this.pid, 'SIGCONT');
      this._isPaused = false;
    }
  }

  /**
   * Kill the process
   */
  kill(): void {
    this.ptyProcess.kill();
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
  }
}
```

**Step 4: Run tests**

Run: `cd packages/node-agent && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(node-agent): implement PTY process wrapper"
```

---

### Task 2.4: Implement WebSocket Client

**Files:**
- Create: `packages/node-agent/src/connection.ts`
- Test: `packages/node-agent/src/connection.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/node-agent/src/connection.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { Connection, ConnectionState } from './connection.js';

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
      reconnectDelay: 100,
      maxReconnectDelay: 200
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/node-agent && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement Connection class**

```typescript
// packages/node-agent/src/connection.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type StateCallback = (state: ConnectionState) => void;
type MessageCallback = (message: string) => void;

interface ConnectionOptions {
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

export class Connection extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private _state: ConnectionState = 'disconnected';
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private currentDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalDisconnect: boolean = false;
  private stateCallbacks: StateCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];

  constructor(url: string, options: ConnectionOptions = {}) {
    super();
    this.url = url;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.currentDelay = this.reconnectDelay;
  }

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const cb of this.stateCallbacks) {
      cb(state);
    }
    this.emit('stateChange', state);
  }

  onStateChange(callback: StateCallback): void {
    this.stateCallbacks.push(callback);
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  connect(): void {
    if (this._state === 'connected' || this._state === 'connecting') {
      return;
    }

    this.intentionalDisconnect = false;
    this.setState('connecting');

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.setState('connected');
      this.currentDelay = this.reconnectDelay; // Reset delay on successful connection
    });

    this.ws.on('message', (data) => {
      const message = data.toString();
      for (const cb of this.messageCallbacks) {
        cb(message);
      }
      this.emit('message', message);
    });

    this.ws.on('close', () => {
      this.ws = null;
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.currentDelay);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  send(message: string): void {
    if (this.ws && this._state === 'connected') {
      this.ws.send(message);
    }
  }
}
```

**Step 4: Run tests**

Run: `cd packages/node-agent && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(node-agent): implement WebSocket client with reconnection"
```

---

### Task 2.5: Implement Node Agent Main Class

**Files:**
- Create: `packages/node-agent/src/agent.ts`
- Update: `packages/node-agent/src/cli.ts`

**Step 1: Implement NodeAgent class**

```typescript
// packages/node-agent/src/agent.ts
import { EventEmitter } from 'events';
import { Identity } from './identity.js';
import { Connection } from './connection.js';
import { ProcessWrapper } from './process-wrapper.js';
import { createEvent, signEvent, Event } from '@agent-conquer/shared';
import type { Agent, AgentStatus, Command, CommandAck } from '@agent-conquer/shared';

interface AgentProcess {
  id: string;
  name: string;
  process: ProcessWrapper;
  status: AgentStatus;
  outputBuffer: string[];
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
      outputBuffer: []
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

  private emitEvent(type: Event['type'], payload: Record<string, unknown>): void {
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
      startedAt: new Date().toISOString(),
      pid: a.process.pid
    }));
  }
}
```

**Step 2: Update CLI to use NodeAgent**

```typescript
// packages/node-agent/src/cli.ts
import { Command } from 'commander';
import { NodeAgent } from './agent.js';

const program = new Command();

program
  .name('agent-conquer-node')
  .description('Node Agent for Agent Conquer control plane')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to the control plane')
  .requiredOption('--server <url>', 'Control plane WebSocket URL')
  .option('--name <name>', 'Node name', 'unnamed-node')
  .option('--data-dir <path>', 'Data directory', './.agent-conquer')
  .action(async (options) => {
    const agent = new NodeAgent({
      serverUrl: options.server,
      nodeName: options.name,
      dataDir: options.dataDir
    });

    // Handle shutdown gracefully
    process.on('SIGINT', () => {
      agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      agent.stop();
      process.exit(0);
    });

    agent.start();
  });

program.parse();
```

**Step 3: Build and verify**

Run: `cd packages/node-agent && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(node-agent): implement main NodeAgent class with command handling"
```

---

## Phase 3: Control Plane Core

### Task 3.1: Initialize Control Plane Package

**Files:**
- Create: `packages/control-plane/package.json`
- Create: `packages/control-plane/tsconfig.json`
- Create: `packages/control-plane/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-conquer/control-plane",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "agent-conquer-server": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "start": "node dist/cli.js",
    "dev": "tsx watch src/cli.ts"
  },
  "dependencies": {
    "@agent-conquer/shared": "workspace:*",
    "express": "^4.18.2",
    "ws": "^8.14.0",
    "ioredis": "^5.3.2",
    "commander": "^11.1.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "@types/cors": "^2.8.17",
    "tsx": "^4.6.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create entry point**

```typescript
// packages/control-plane/src/index.ts
export { ControlPlane } from './server.js';
export { NodeRegistry } from './registry.js';
export { CommandRouter } from './commands.js';
```

**Step 4: Install dependencies**

Run: `cd packages/control-plane && npm install`
Expected: Dependencies installed

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(control-plane): initialize package structure"
```

---

### Task 3.2: Implement Node Registry

**Files:**
- Create: `packages/control-plane/src/registry.ts`
- Test: `packages/control-plane/src/registry.test.ts`

**Step 1: Write the failing test**

```typescript
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

    // Wait a bit
    registry.updateHeartbeat('node-1');

    const after = registry.getNode('node-1')?.lastHeartbeat;
    expect(after).not.toBe(before);
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
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/control-plane && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement NodeRegistry**

```typescript
// packages/control-plane/src/registry.ts
import type { Node, Agent, NodeStatus, AgentStatus } from '@agent-conquer/shared';

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
```

**Step 4: Run tests**

Run: `cd packages/control-plane && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(control-plane): implement node and agent registry"
```

---

### Task 3.3: Implement Command Router

**Files:**
- Create: `packages/control-plane/src/commands.ts`
- Test: `packages/control-plane/src/commands.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/control-plane/src/commands.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRouter } from './commands.js';
import type { Command } from '@agent-conquer/shared';

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
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/control-plane && npx vitest run`
Expected: FAIL - module not found

**Step 3: Implement CommandRouter**

```typescript
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
```

**Step 4: Run tests**

Run: `cd packages/control-plane && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(control-plane): implement command routing with queuing"
```

---

### Task 3.4: Implement Control Plane Server

**Files:**
- Create: `packages/control-plane/src/server.ts`
- Create: `packages/control-plane/src/cli.ts`

**Step 1: Implement ControlPlane server**

```typescript
// packages/control-plane/src/server.ts
import express, { Express, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import cors from 'cors';
import { NodeRegistry } from './registry.js';
import { CommandRouter } from './commands.js';
import { verifyEvent, Event } from '@agent-conquer/shared';
import type { CommandAck, CommandType } from '@agent-conquer/shared';

interface ControlPlaneOptions {
  port: number;
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
    this.app.get('/api/nodes', (req: Request, res: Response) => {
      res.json(this.registry.getAllNodes());
    });

    // List all agents
    this.app.get('/api/agents', (req: Request, res: Response) => {
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
    this.app.get('/health', (req: Request, res: Response) => {
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
      case 'agent.started':
        const startPayload = event.payload as { agentId: string; name: string; pid: number };
        this.registry.registerAgent(event.nodeId, startPayload.agentId, startPayload.name, startPayload.pid);
        break;
      case 'agent.stopped':
        const stopPayload = event.payload as { agentId: string };
        this.registry.removeAgent(stopPayload.agentId);
        break;
      case 'agent.state_changed':
        const statePayload = event.payload as { agentId: string; status: string };
        this.registry.updateAgentStatus(statePayload.agentId, statePayload.status as any);
        break;
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

  start(port: number): void {
    this.server.listen(port, () => {
      console.log(`Control Plane running on port ${port}`);
      console.log(`  API: http://localhost:${port}/api`);
      console.log(`  Node WS: ws://localhost:${port}/ws/node`);
      console.log(`  Dashboard WS: ws://localhost:${port}/ws/dashboard`);
    });
  }

  stop(): void {
    this.wss.close();
    this.server.close();
  }
}
```

**Step 2: Implement CLI**

```typescript
// packages/control-plane/src/cli.ts
import { Command } from 'commander';
import { ControlPlane } from './server.js';

const program = new Command();

program
  .name('agent-conquer-server')
  .description('Control Plane for Agent Conquer')
  .version('0.1.0');

program
  .command('start')
  .description('Start the control plane server')
  .option('--port <port>', 'Port to listen on', '3000')
  .option('--data-dir <path>', 'Data directory', './data')
  .action((options) => {
    const server = new ControlPlane({
      port: parseInt(options.port, 10),
      dataDir: options.dataDir
    });

    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      server.stop();
      process.exit(0);
    });

    server.start(parseInt(options.port, 10));
  });

program.parse();
```

**Step 3: Build and verify**

Run: `cd packages/control-plane && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(control-plane): implement WebSocket server with API endpoints"
```

---

## Phase 4: Dashboard Foundation

### Task 4.1: Initialize Dashboard Package

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/index.html`
- Create: `packages/dashboard/src/main.tsx`
- Create: `packages/dashboard/src/App.tsx`

**Step 1: Create package.json**

```json
{
  "name": "@agent-conquer/dashboard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@agent-conquer/shared": "workspace:*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "pixi.js": "^8.0.0",
    "@pixi/react": "^7.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
```

**Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Conquer</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create main.tsx**

```typescript
// packages/dashboard/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 6: Create App.tsx skeleton**

```typescript
// packages/dashboard/src/App.tsx
import React from 'react';

export function App() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px', background: '#16213e', borderBottom: '1px solid #0f3460' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Agent Conquer</h1>
      </header>
      <main style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Canvas will be rendered here</p>
        </div>
      </main>
    </div>
  );
}
```

**Step 7: Install dependencies**

Run: `cd packages/dashboard && npm install`
Expected: Dependencies installed

**Step 8: Verify dev server starts**

Run: `cd packages/dashboard && npm run dev`
Expected: Vite dev server starts, accessible at http://localhost:5173

**Step 9: Commit**

```bash
git add -A
git commit -m "feat(dashboard): initialize React + Vite + PixiJS package"
```

---

### Task 4.2: Implement WebSocket State Hook

**Files:**
- Create: `packages/dashboard/src/hooks/useControlPlane.ts`
- Create: `packages/dashboard/src/types.ts`

**Step 1: Create local types**

```typescript
// packages/dashboard/src/types.ts
import type { Node, Agent, Event } from '@agent-conquer/shared';

export interface ControlPlaneState {
  connected: boolean;
  nodes: Map<string, Node>;
  agents: Map<string, Agent>;
}

export interface DashboardEvent {
  type: string;
  [key: string]: unknown;
}
```

**Step 2: Implement useControlPlane hook**

```typescript
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
  }, []);

  const handleMessage = useCallback((message: DashboardEvent) => {
    switch (message.type) {
      case 'state.full':
        // Initial state sync
        const nodes = new Map<string, Node>();
        const agents = new Map<string, Agent>();

        for (const node of (message.nodes as Node[])) {
          nodes.set(node.id, node);
        }
        for (const agent of (message.agents as Agent[])) {
          agents.set(agent.id, agent);
        }

        setState((prev) => ({ ...prev, nodes, agents }));
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
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(dashboard): implement WebSocket state management hook"
```

---

### Task 4.3: Implement PixiJS Canvas

**Files:**
- Create: `packages/dashboard/src/components/Canvas.tsx`
- Create: `packages/dashboard/src/components/House.tsx`
- Create: `packages/dashboard/src/components/Robot.tsx`
- Update: `packages/dashboard/src/App.tsx`

**Step 1: Create Canvas component**

```typescript
// packages/dashboard/src/components/Canvas.tsx
import React, { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Node, Agent } from '@agent-conquer/shared';

interface CanvasProps {
  nodes: Node[];
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
}

const HOUSE_WIDTH = 200;
const HOUSE_HEIGHT = 150;
const HOUSE_SPACING = 50;

export function Canvas({ nodes, agents, onSelectAgent }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new Application();

    const init = async () => {
      await app.init({
        background: '#1a1a2e',
        resizeTo: containerRef.current!,
        antialias: true
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;
    };

    init();

    return () => {
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    // Clear existing graphics
    app.stage.removeChildren();

    // Create world container for panning
    const world = new Container();
    app.stage.addChild(world);

    // Draw houses (nodes)
    nodes.forEach((node, index) => {
      const x = 50 + (index % 3) * (HOUSE_WIDTH + HOUSE_SPACING);
      const y = 50 + Math.floor(index / 3) * (HOUSE_HEIGHT + HOUSE_SPACING + 50);

      const house = new Container();
      house.position.set(x, y);

      // House body
      const body = new Graphics();
      const color = node.status === 'connected' ? 0x2d6a4f : 0x6c757d;
      body.roundRect(0, 0, HOUSE_WIDTH, HOUSE_HEIGHT, 10);
      body.fill(color);
      body.stroke({ width: 2, color: node.status === 'connected' ? 0x40916c : 0x495057 });
      house.addChild(body);

      // Roof
      const roof = new Graphics();
      roof.moveTo(HOUSE_WIDTH / 2, -30);
      roof.lineTo(HOUSE_WIDTH + 10, 10);
      roof.lineTo(-10, 10);
      roof.closePath();
      roof.fill(node.status === 'connected' ? 0x1b4332 : 0x495057);
      house.addChild(roof);

      // Node name
      const nameStyle = new TextStyle({
        fontSize: 14,
        fill: '#ffffff',
        fontWeight: 'bold'
      });
      const nameText = new Text({ text: node.name, style: nameStyle });
      nameText.position.set(10, 10);
      house.addChild(nameText);

      // Status indicator
      const statusDot = new Graphics();
      statusDot.circle(HOUSE_WIDTH - 20, 20, 6);
      statusDot.fill(node.status === 'connected' ? 0x52b788 : 0xdc3545);
      house.addChild(statusDot);

      // Draw robots (agents) inside this house
      const nodeAgents = agents.filter((a) => a.nodeId === node.id);
      nodeAgents.forEach((agent, agentIndex) => {
        const robotX = 20 + (agentIndex % 3) * 60;
        const robotY = 50 + Math.floor(agentIndex / 3) * 50;

        const robot = new Container();
        robot.position.set(robotX, robotY);
        robot.eventMode = 'static';
        robot.cursor = 'pointer';
        robot.on('pointerdown', () => onSelectAgent(agent.id));

        // Robot body
        const robotBody = new Graphics();
        const robotColor = getStatusColor(agent.status);
        robotBody.roundRect(0, 0, 50, 40, 5);
        robotBody.fill(robotColor);
        house.addChild(robot);

        // Robot head
        const head = new Graphics();
        head.circle(25, -5, 12);
        head.fill(robotColor);
        robot.addChild(head);

        // Eyes
        const leftEye = new Graphics();
        leftEye.circle(20, -7, 3);
        leftEye.fill(0xffffff);
        robot.addChild(leftEye);

        const rightEye = new Graphics();
        rightEye.circle(30, -7, 3);
        rightEye.fill(0xffffff);
        robot.addChild(rightEye);

        robot.addChild(robotBody);

        // Agent name (truncated)
        const agentNameStyle = new TextStyle({
          fontSize: 10,
          fill: '#ffffff'
        });
        const agentName = new Text({
          text: agent.name.slice(0, 8),
          style: agentNameStyle
        });
        agentName.position.set(5, 45);
        robot.addChild(agentName);

        house.addChild(robot);
      });

      world.addChild(house);
    });

    // Enable panning
    let dragging = false;
    let lastPos = { x: 0, y: 0 };

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointerdown', (e) => {
      dragging = true;
      lastPos = { x: e.global.x, y: e.global.y };
    });

    app.stage.on('pointerup', () => {
      dragging = false;
    });

    app.stage.on('pointermove', (e) => {
      if (dragging) {
        const dx = e.global.x - lastPos.x;
        const dy = e.global.y - lastPos.y;
        world.position.x += dx;
        world.position.y += dy;
        lastPos = { x: e.global.x, y: e.global.y };
      }
    });

  }, [nodes, agents, onSelectAgent]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function getStatusColor(status: Agent['status']): number {
  switch (status) {
    case 'idle': return 0x6c757d;
    case 'thinking': return 0x0077b6;
    case 'executing': return 0x52b788;
    case 'paused': return 0xfca311;
    case 'error': return 0xdc3545;
    default: return 0x6c757d;
  }
}
```

**Step 2: Update App.tsx**

```typescript
// packages/dashboard/src/App.tsx
import React, { useState } from 'react';
import { Canvas } from './components/Canvas';
import { useControlPlane } from './hooks/useControlPlane';
import type { Agent } from '@agent-conquer/shared';

export function App() {
  const { connected, nodes, agents, sendCommand } = useControlPlane();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleSelectAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    setSelectedAgent(agent ?? null);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '12px 16px',
        background: '#16213e',
        borderBottom: '1px solid #0f3460',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Agent Conquer</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#aaa' }}>
            {nodes.length} nodes, {agents.length} agents
          </span>
          <span style={{
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: connected ? '#2d6a4f' : '#dc3545'
          }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1 }}>
          <Canvas
            nodes={nodes}
            agents={agents}
            onSelectAgent={handleSelectAgent}
          />
        </div>

        {selectedAgent && (
          <aside style={{
            width: '320px',
            background: '#16213e',
            borderLeft: '1px solid #0f3460',
            padding: '16px',
            overflow: 'auto'
          }}>
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>{selectedAgent.name}</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>Status</label>
              <div style={{
                padding: '8px 12px',
                background: '#0f3460',
                borderRadius: '4px',
                marginTop: '4px'
              }}>
                {selectedAgent.status}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>PID</label>
              <div style={{
                padding: '8px 12px',
                background: '#0f3460',
                borderRadius: '4px',
                marginTop: '4px'
              }}>
                {selectedAgent.pid}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => sendCommand(selectedAgent.id, 'pause_agent')}
                disabled={selectedAgent.status === 'paused'}
                style={{
                  padding: '10px',
                  background: '#fca311',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  cursor: 'pointer',
                  opacity: selectedAgent.status === 'paused' ? 0.5 : 1
                }}
              >
                Pause
              </button>

              <button
                onClick={() => sendCommand(selectedAgent.id, 'resume_agent')}
                disabled={selectedAgent.status !== 'paused'}
                style={{
                  padding: '10px',
                  background: '#52b788',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: selectedAgent.status !== 'paused' ? 0.5 : 1
                }}
              >
                Resume
              </button>

              <button
                onClick={() => sendCommand(selectedAgent.id, 'stop_agent')}
                style={{
                  padding: '10px',
                  background: '#dc3545',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Stop
              </button>
            </div>

            <button
              onClick={() => setSelectedAgent(null)}
              style={{
                marginTop: '16px',
                padding: '8px',
                background: 'transparent',
                border: '1px solid #0f3460',
                borderRadius: '4px',
                color: '#aaa',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Close
            </button>
          </aside>
        )}
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(dashboard): implement PixiJS canvas with houses and robots"
```

---

## Phase 5: Integration and Testing

### Task 5.1: Create Integration Test Script

**Files:**
- Create: `scripts/test-integration.sh`

**Step 1: Create test script**

```bash
#!/bin/bash
# scripts/test-integration.sh

echo "=== Agent Conquer Integration Test ==="

# Start Redis (assuming installed)
echo "Starting Redis..."
redis-server --daemonize yes

# Build all packages
echo "Building packages..."
npm run build

# Start Control Plane in background
echo "Starting Control Plane..."
cd packages/control-plane
node dist/cli.js start --port 3000 &
CP_PID=$!
cd ../..

sleep 2

# Start Node Agent in background
echo "Starting Node Agent..."
cd packages/node-agent
node dist/cli.js connect --server ws://localhost:3000 --name test-node &
NA_PID=$!
cd ../..

sleep 2

# Test API endpoints
echo "Testing API..."
curl -s http://localhost:3000/health | grep -q "ok" && echo "  Health: OK" || echo "  Health: FAILED"
curl -s http://localhost:3000/api/nodes | grep -q "test-node" && echo "  Nodes: OK" || echo "  Nodes: FAILED"

# Cleanup
echo "Cleaning up..."
kill $NA_PID 2>/dev/null
kill $CP_PID 2>/dev/null
redis-cli shutdown 2>/dev/null

echo "=== Integration Test Complete ==="
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/test-integration.sh
git add -A
git commit -m "feat: add integration test script"
```

---

### Task 5.2: Create Development Workflow Script

**Files:**
- Create: `scripts/dev.sh`
- Update: `package.json`

**Step 1: Create dev script**

```bash
#!/bin/bash
# scripts/dev.sh
# Starts all services for development

trap "kill 0" EXIT

echo "Starting Agent Conquer development environment..."

# Start Control Plane
echo "Starting Control Plane on port 3000..."
cd packages/control-plane && npm run dev &

sleep 2

# Start Dashboard
echo "Starting Dashboard on port 5173..."
cd packages/dashboard && npm run dev &

echo ""
echo "=== Development servers running ==="
echo "  Control Plane: http://localhost:3000"
echo "  Dashboard: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

wait
```

**Step 2: Update root package.json**

Add to scripts:
```json
{
  "scripts": {
    "dev": "./scripts/dev.sh",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "test:integration": "./scripts/test-integration.sh"
  }
}
```

**Step 3: Make executable and commit**

```bash
chmod +x scripts/dev.sh
git add -A
git commit -m "feat: add development workflow scripts"
```

---

## Summary

This plan implements Agent Conquer in 5 phases:

1. **Phase 1: Project Foundation** - Monorepo setup, shared types, crypto, events
2. **Phase 2: Node Agent Core** - Identity, PTY wrapper, WebSocket client, main agent
3. **Phase 3: Control Plane Core** - Registry, command routing, WebSocket server, API
4. **Phase 4: Dashboard Foundation** - React setup, WebSocket hook, PixiJS canvas
5. **Phase 5: Integration** - Test scripts, dev workflow

Each task follows TDD with bite-sized steps (2-5 min each) and frequent commits.

**Total tasks:** 17
**Estimated commits:** 17+

---

## End of Plan

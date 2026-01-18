# Agent Conquer - System Design

**Date:** 2026-01-18
**Status:** Approved for implementation

## Context

Personal infrastructure tool for controlling Claude Code agents across 2-5 machines connected via local network and Tailscale. Single operator use case.

## System Overview

Three components:

1. **Node Agent** (`agent-conquer-node`) - NPX package installed on each machine. Spawns and wraps Claude Code processes via PTY, captures all I/O, executes commands from Control Plane, reports events over WebSocket.

2. **Control Plane** (`agent-conquer-server`) - Runs on one machine. Accepts WebSocket connections from Node Agents, maintains real-time state in Redis, persists conversations to JSON files, serves the dashboard, routes commands to agents.

3. **Dashboard** - PixiJS-based 2D visualization served by Control Plane. Shows houses (nodes), robots (agents), real-time activity. Provides controls for interacting with agents.

### Communication Flow

```
[Node Agent] <--WebSocket--> [Control Plane] <--WebSocket--> [Dashboard]
     |                            |
  [Claude Code]              [Redis + Files]
```

All messages signed with ed25519 keys. Node Agents generate keys on first run, register public key with Control Plane.

---

## Node Agent Architecture

### Process Management

- Uses `node-pty` to spawn Claude Code with full terminal emulation
- Captures stdout in real-time, parses for meaningful events
- Can write to stdin to inject messages/commands
- Manages process lifecycle (start, pause via SIGSTOP, resume via SIGCONT, kill)

### Local State

- Tracks all managed Claude Code processes
- Buffers output for transmission to Control Plane
- Queues commands when disconnected, executes on reconnect
- Stores conversation history locally as JSON (source of truth)

### Event Emission

- Streams parsed events to Control Plane: agent state changes, tool calls, messages, errors
- Each event signed with node's private key
- Monotonic sequence numbers for ordering

### Command Execution

- Receives commands over WebSocket: start_agent, stop_agent, pause_agent, send_message, etc.
- Validates command signatures from Control Plane
- Executes locally, streams result events back

### Usage

```bash
npx agent-conquer-node --server wss://control-plane:3000 --name "workstation-1"
```

Agents registered via CLI or config file, not auto-discovered.

---

## Control Plane Architecture

### WebSocket Server

- Accepts connections from Node Agents (authenticated via key exchange)
- Accepts connections from Dashboard (session token auth)
- Broadcasts state changes to all connected dashboards in real-time

### State Management (Redis)

- `nodes:{id}` - Node status, last heartbeat, metadata
- `agents:{id}` - Agent status, current task, parent node
- `events:stream` - Redis Stream for event log (recent events for replay)
- Pub/sub channels for real-time dashboard updates

### Persistence (JSON Files)

- `data/conversations/{agent_id}/{timestamp}.json` - Full conversation logs
- `data/nodes/{node_id}/config.json` - Node registration and metadata
- Files synced from Node Agents periodically and on-demand

### Command Routing

- Dashboard sends command → Control Plane validates → Routes to correct Node Agent
- Commands queued if node disconnected
- Acknowledgment flow: accepted → executing → completed/failed

### API Endpoints

- `GET /api/nodes` - List all nodes
- `GET /api/agents` - List all agents
- `GET /api/agents/{id}/history` - Conversation history
- `POST /api/agents/{id}/command` - Issue command
- `WS /ws/dashboard` - Real-time updates for UI
- `WS /ws/node` - Node Agent connection

---

## Dashboard Visualization

### Main Canvas (PixiJS)

- 2D top-down or isometric view of the "agent empire"
- Pan and zoom with mouse/trackpad
- Responsive to window size

### Houses (Nodes)

Each node rendered as a house sprite. Visual states via color/animation:

| State | Visual |
|-------|--------|
| Connected | Lights on, warm glow |
| Disconnected | Greyed out, flickering |
| Overloaded | Red tint, smoke particles |

- House size scales with agent count
- Hover shows node name, IP, resource usage

### Robots (Agents)

Animated sprites inside/near their house. Visual states:

| State | Visual |
|-------|--------|
| Idle | Standing still |
| Thinking | Pulsing/glowing head |
| Executing | Arms moving, activity particles |
| Paused | Greyed out, "ZZZ" indicator |
| Error | Red, warning icon |

- Click to select, opens detail panel

### Activity Indicators

- Speech bubbles showing recent messages (truncated)
- Floating icons for tool usage
- Connection lines pulse when events flow

---

## Dashboard Controls & Panels

### Side Panel (HTML overlay)

Opens when clicking a robot or house. Three tabs:

**Chat tab:**
- Live scrolling conversation view
- Input box to send messages to agent
- "Inject system message" option
- Clear history button (with confirmation)

**Status tab:**
- Agent state, uptime, current task
- Node metrics (CPU, memory)
- Recent events list
- Error log if any

**Controls tab:**
- Pause / Resume buttons
- Restart agent button
- Kill agent button (with confirmation)
- Context: view, inject, clear

### Top Bar

- Node count, agent count, error count
- Global search (agents, conversations)
- Settings gear (control plane URL, theme)

### Command Feedback

- Toast notifications for command status
- Commands show pending state until acknowledged
- Failed commands show error with retry option

---

## Data Model

### Core Entities

```typescript
interface Node {
  id: string;
  name: string;
  publicKey: string;
  address: string;
  status: "connected" | "disconnected" | "degraded";
  lastHeartbeat: Date;
  metrics: {
    cpu: number;
    memory: number;
    uptime: number;
  };
}

interface Agent {
  id: string;
  nodeId: string;
  name: string;
  status: "idle" | "thinking" | "executing" | "paused" | "error";
  currentTask: string | null;
  startedAt: Date;
  pid: number;
}

interface Conversation {
  agentId: string;
  messages: Message[];
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}
```

### Event Schema

```typescript
interface Event {
  eventId: string;       // UUID
  nodeId: string;
  agentId?: string;
  type: string;
  timestamp: string;     // ISO8601
  sequence: number;      // Monotonic per node
  payload: object;
  signature: string;     // ed25519 signature
}
```

### Key Event Types

- `node.connected`, `node.disconnected`, `node.heartbeat`
- `agent.started`, `agent.stopped`, `agent.state_changed`
- `message.received`, `message.sent`
- `command.received`, `command.executed`, `command.failed`

---

## Security & Deployment

### Authentication

- **Node Agents:** ed25519 keypair generated on first run, public key registered with Control Plane
- **Dashboard:** Simple shared secret or password for v1 (single operator)
- All WebSocket messages signed, invalid signatures rejected

### Network Security

- Tailscale/VPN handles transport encryption between machines
- Control Plane binds to Tailscale IP (not public)
- Optional: TLS on WebSocket for defense in depth

### Deployment

```bash
# On control plane machine:
npx agent-conquer-server --port 3000 --data ./data

# On each agent machine:
npx agent-conquer-node --server wss://100.x.x.x:3000 --name "machine-1"
```

### Failure Handling

- Node Agent auto-reconnects with exponential backoff
- Commands queued during disconnect, executed on reconnect
- Dashboard shows stale state clearly when disconnected

---

## Not in v1

- Multi-user auth / permissions
- Automatic agent discovery (explicit registration only)
- Cross-agent context sharing
- Time-travel replay
- Self-healing / auto-restart
- Mobile UI

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Node Agent | Node.js, node-pty, ws, tweetnacl |
| Control Plane | Node.js, Express, ws, Redis, tweetnacl |
| Dashboard | React, PixiJS, WebSocket |
| Storage | Redis (state), JSON files (history) |

---

## End of Design

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

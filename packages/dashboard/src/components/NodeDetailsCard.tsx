// packages/dashboard/src/components/NodeDetailsCard.tsx
import { useState } from 'react';
import type { Node, Agent } from '@agent-conquer/shared';

interface NodeDetailsCardProps {
  node: Node;
  agents: Agent[];
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  onStartAgent: (nodeId: string, agentName: string) => void;
}

export function NodeDetailsCard({
  node,
  agents,
  onClose,
  onSelectAgent,
  onStartAgent
}: NodeDetailsCardProps) {
  const [newAgentName, setNewAgentName] = useState('');

  const handleStartAgent = () => {
    if (newAgentName.trim()) {
      onStartAgent(node.id, newAgentName.trim());
      setNewAgentName('');
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const truncateKey = (key: string): string => {
    if (key.length <= 16) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const getStatusColor = (status: Agent['status']): string => {
    switch (status) {
      case 'idle': return '#6c757d';
      case 'thinking': return '#0077b6';
      case 'executing': return '#52b788';
      case 'paused': return '#fca311';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div style={{
      width: '320px',
      background: '#16213e',
      borderLeft: '1px solid #0f3460',
      padding: '16px',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '16px', margin: 0 }}>{node.name}</h2>
          <span style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: node.status === 'connected' ? '#2d6a4f' : '#dc3545',
            color: '#fff'
          }}>
            {node.status}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px'
          }}
        >
          &times;
        </button>
      </div>

      {/* Node Info */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '8px' }}>
          Node Info
        </label>
        <div style={{
          background: '#0f3460',
          borderRadius: '4px',
          padding: '12px',
          fontSize: '13px'
        }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#aaa' }}>ID: </span>
            <span style={{ fontFamily: 'monospace' }}>{node.id.slice(0, 12)}...</span>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#aaa' }}>Address: </span>
            <span>{node.address || 'N/A'}</span>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#aaa' }}>Public Key: </span>
            <span style={{ fontFamily: 'monospace' }}>{truncateKey(node.publicKey)}</span>
          </div>
          <div>
            <span style={{ color: '#aaa' }}>Last Heartbeat: </span>
            <span>{node.lastHeartbeat ? new Date(node.lastHeartbeat).toLocaleTimeString() : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '8px' }}>
          Metrics
        </label>
        <div style={{
          background: '#0f3460',
          borderRadius: '4px',
          padding: '12px'
        }}>
          {/* CPU */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>CPU</span>
              <span>{node.metrics?.cpu ?? 0}%</span>
            </div>
            <div style={{ background: '#1a1a2e', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                width: `${node.metrics?.cpu ?? 0}%`,
                height: '100%',
                background: (node.metrics?.cpu ?? 0) > 80 ? '#dc3545' : '#52b788',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>

          {/* Memory */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Memory</span>
              <span>{node.metrics?.memory ?? 0}%</span>
            </div>
            <div style={{ background: '#1a1a2e', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                width: `${node.metrics?.memory ?? 0}%`,
                height: '100%',
                background: (node.metrics?.memory ?? 0) > 80 ? '#dc3545' : '#0077b6',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>

          {/* Uptime */}
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: '#aaa' }}>Uptime: </span>
            <span>{formatUptime(node.metrics?.uptime ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div style={{ marginBottom: '16px', flex: 1 }}>
        <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '8px' }}>
          Agents ({agents.length})
        </label>
        <div style={{
          background: '#0f3460',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {agents.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
              No agents running on this node
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #1a1a2e',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1a3a5e'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '13px' }}>{agent.name}</span>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getStatusColor(agent.status)
                }} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Start Agent */}
      <div>
        <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '8px' }}>
          Start New Agent
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Agent name"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartAgent()}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#0f3460',
              border: '1px solid #1a3a5e',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleStartAgent}
            disabled={!newAgentName.trim() || node.status !== 'connected'}
            style={{
              padding: '8px 16px',
              background: node.status === 'connected' && newAgentName.trim() ? '#52b788' : '#4a4a4a',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: node.status === 'connected' && newAgentName.trim() ? 'pointer' : 'not-allowed',
              fontSize: '13px'
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

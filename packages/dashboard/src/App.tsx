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

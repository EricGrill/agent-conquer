#!/bin/bash
# scripts/test-integration.sh
# Integration test for Agent Conquer

set -e

echo "=== Agent Conquer Integration Test ==="

# Build all packages
echo "Building packages..."
npm run build --workspaces --if-present

# Start Control Plane in background
echo "Starting Control Plane..."
node packages/control-plane/dist/cli.js start --port 3001 &
CP_PID=$!

# Give it time to start
sleep 2

# Test API endpoints
echo ""
echo "Testing API endpoints..."

# Health check
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q "ok"; then
  echo "  ✓ Health check passed"
else
  echo "  ✗ Health check failed"
  kill $CP_PID 2>/dev/null
  exit 1
fi

# Get nodes (should be empty)
NODES=$(curl -s http://localhost:3001/api/nodes)
if echo "$NODES" | grep -q "\[\]"; then
  echo "  ✓ Nodes endpoint working (empty list)"
else
  echo "  ✗ Nodes endpoint failed"
  kill $CP_PID 2>/dev/null
  exit 1
fi

# Get agents (should be empty)
AGENTS=$(curl -s http://localhost:3001/api/agents)
if echo "$AGENTS" | grep -q "\[\]"; then
  echo "  ✓ Agents endpoint working (empty list)"
else
  echo "  ✗ Agents endpoint failed"
  kill $CP_PID 2>/dev/null
  exit 1
fi

# Cleanup
echo ""
echo "Cleaning up..."
kill $CP_PID 2>/dev/null

echo ""
echo "=== All Integration Tests Passed ==="

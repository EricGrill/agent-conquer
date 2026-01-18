#!/bin/bash
# scripts/dev.sh
# Starts all services for development

trap "kill 0" EXIT

echo "Starting Agent Conquer development environment..."

# Build shared package first
echo "Building shared package..."
npm run build --workspace=@agent-conquer/shared

# Start Control Plane
echo "Starting Control Plane on port 3000..."
npm run start --workspace=@agent-conquer/control-plane -- start --port 3000 &

sleep 2

# Start Dashboard
echo "Starting Dashboard on port 5173..."
npm run dev --workspace=@agent-conquer/dashboard &

echo ""
echo "=== Development servers running ==="
echo "  Control Plane: http://localhost:3000"
echo "  Dashboard: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

wait

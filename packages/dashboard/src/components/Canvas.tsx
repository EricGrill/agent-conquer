// packages/dashboard/src/components/Canvas.tsx
import { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Node, Agent } from '@agent-conquer/shared';

interface CanvasProps {
  nodes: Node[];
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId?: string;
}

const HOUSE_WIDTH = 200;
const HOUSE_HEIGHT = 150;
const HOUSE_SPACING = 50;

export function Canvas({ nodes, agents, onSelectAgent, onSelectNode, selectedNodeId }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new Application();
    let mounted = true;

    const init = async () => {
      await app.init({
        background: '#1a1a2e',
        resizeTo: containerRef.current!,
        antialias: true
      });

      if (!mounted) {
        // Component unmounted during init, clean up
        app.destroy(true);
        return;
      }

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;
    };

    init();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !app.stage) return;

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
      const isSelected = node.id === selectedNodeId;
      body.roundRect(0, 0, HOUSE_WIDTH, HOUSE_HEIGHT, 10);
      body.fill(color);
      body.stroke({ width: isSelected ? 3 : 2, color: isSelected ? 0xfca311 : (node.status === 'connected' ? 0x40916c : 0x495057) });
      body.eventMode = 'static';
      body.cursor = 'pointer';
      body.on('pointerdown', (e) => {
        e.stopPropagation();
        onSelectNode(node.id);
      });
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
        robot.on('pointerdown', (e) => {
          e.stopPropagation();
          onSelectAgent(agent.id);
        });

        // Robot body
        const robotBody = new Graphics();
        const robotColor = getStatusColor(agent.status);
        robotBody.roundRect(0, 0, 50, 40, 5);
        robotBody.fill(robotColor);
        robot.addChild(robotBody);

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

  }, [nodes, agents, onSelectAgent, onSelectNode, selectedNodeId]);

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

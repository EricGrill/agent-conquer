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

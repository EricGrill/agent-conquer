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

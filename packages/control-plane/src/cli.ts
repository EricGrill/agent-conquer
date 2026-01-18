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
  .option('--host <host>', 'Host to bind to', '0.0.0.0')
  .option('--data-dir <path>', 'Data directory', './data')
  .action((options) => {
    const server = new ControlPlane({
      port: parseInt(options.port, 10),
      host: options.host,
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

    server.start(parseInt(options.port, 10), options.host);
  });

program.parse();

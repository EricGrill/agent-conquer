// packages/node-agent/src/process-wrapper.ts
import * as pty from 'node-pty';
import { EventEmitter } from 'events';

type DataCallback = (data: string) => void;
type ExitCallback = (code: number) => void;

export class ProcessWrapper extends EventEmitter {
  private ptyProcess: pty.IPty;
  private _isPaused: boolean = false;
  private dataCallbacks: DataCallback[] = [];
  private exitCallbacks: ExitCallback[] = [];

  constructor(command: string, args: string[], cwd?: string) {
    super();

    this.ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: cwd ?? process.cwd(),
      env: process.env as { [key: string]: string }
    });

    this.ptyProcess.onData((data) => {
      for (const cb of this.dataCallbacks) {
        cb(data);
      }
      this.emit('data', data);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      for (const cb of this.exitCallbacks) {
        cb(exitCode);
      }
      this.emit('exit', exitCode);
    });
  }

  get pid(): number {
    return this.ptyProcess.pid;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Register a callback for data output
   */
  onData(callback: DataCallback): void {
    this.dataCallbacks.push(callback);
  }

  /**
   * Register a callback for process exit
   */
  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback);
  }

  /**
   * Write to the process stdin
   */
  write(data: string): void {
    this.ptyProcess.write(data);
  }

  /**
   * Pause the process (SIGSTOP)
   */
  pause(): void {
    if (!this._isPaused) {
      process.kill(this.pid, 'SIGSTOP');
      this._isPaused = true;
    }
  }

  /**
   * Resume the process (SIGCONT)
   */
  resume(): void {
    if (this._isPaused) {
      process.kill(this.pid, 'SIGCONT');
      this._isPaused = false;
    }
  }

  /**
   * Kill the process
   */
  kill(): void {
    this.ptyProcess.kill();
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
  }
}

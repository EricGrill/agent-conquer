// packages/node-agent/src/process-wrapper.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { ProcessWrapper } from './process-wrapper.js';

describe('ProcessWrapper', () => {
  let wrapper: ProcessWrapper | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.kill();
      wrapper = null;
    }
  });

  it('spawns a process and captures output', async () => {
    wrapper = new ProcessWrapper('echo', ['hello world']);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      wrapper!.onData((chunk) => {
        data += chunk;
      });
      wrapper!.onExit(() => {
        resolve(data);
      });
    });

    expect(output.trim()).toContain('hello world');
  });

  it('writes to stdin', async () => {
    wrapper = new ProcessWrapper('cat', []);

    const output = await new Promise<string>((resolve) => {
      let data = '';
      wrapper!.onData((chunk) => {
        data += chunk;
      });

      wrapper!.write('test input\n');

      // Give it time to process
      setTimeout(() => {
        wrapper!.kill();
        resolve(data);
      }, 100);
    });

    expect(output).toContain('test input');
  });

  it('reports process ID', () => {
    wrapper = new ProcessWrapper('sleep', ['10']);
    expect(wrapper.pid).toBeGreaterThan(0);
  });

  it('can pause and resume process', async () => {
    wrapper = new ProcessWrapper('sleep', ['10']);

    wrapper.pause();
    expect(wrapper.isPaused).toBe(true);

    wrapper.resume();
    expect(wrapper.isPaused).toBe(false);
  });
});

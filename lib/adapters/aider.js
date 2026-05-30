'use strict';

const { AgentAdapter } = require('./base');
const { parseAiderOutput } = require('../cost');
const { spawn } = require('child_process');

/**
 * Adapter for Aider (CLI-based).
 */
class AiderAdapter extends AgentAdapter {
  name = 'aider';

  /**
   * @param {import('../task').Task} task
   * @param {string} workdir
   * @returns {Promise<import('./base').AgentRunResult>}
   */
  async run(task, workdir) {
    const start = Date.now();

    return new Promise((resolve) => {
      const proc = spawn(
        'aider',
        ['--message', task.description, '--yes-always', '--no-git'],
        { cwd: workdir, timeout: task.timeoutSeconds * 1000 }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('error', (err) => {
        const duration = (Date.now() - start) / 1000;
        if (err.code === 'ENOENT') {
          resolve({
            exitCode: -1,
            stdout: '',
            stderr: 'aider CLI not found',
            durationSeconds: duration,
            tokensUsed: null,
            costUsd: null,
          });
        } else {
          resolve({
            exitCode: -1,
            stdout: '',
            stderr: err.message,
            durationSeconds: duration,
            tokensUsed: null,
            costUsd: null,
          });
        }
      });

      proc.on('close', (exitCode) => {
        const duration = (Date.now() - start) / 1000;
        const { tokens, cost } = parseAiderOutput(stdout);

        resolve({
          exitCode: exitCode != null ? exitCode : -1,
          stdout,
          stderr,
          durationSeconds: duration,
          tokensUsed: tokens,
          costUsd: cost,
        });
      });
    });
  }

  isAvailable() {
    return !!require('child_process').spawnSync('which', ['aider'], { stdio: 'pipe' }).stdout.toString().trim();
  }
}

module.exports = { AiderAdapter };
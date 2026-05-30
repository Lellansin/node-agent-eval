'use strict';

const { AgentAdapter } = require('./base');
const { parseClaudeCodeOutput } = require('../cost');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Adapter for Claude Code (CLI-based).
 */
class ClaudeCodeAdapter extends AgentAdapter {
  name = 'claude-code';

  /**
   * @param {import('../task').Task} task
   * @param {string} workdir
   * @returns {Promise<import('./base').AgentRunResult>}
   */
  async run(task, workdir) {
    const start = Date.now();

    return new Promise((resolve) => {
      const proc = spawn(
        'claude',
        ['-p', task.description, '--output-format', 'json'],
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
            stderr: 'claude CLI not found',
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
        const { tokens, cost } = parseClaudeCodeOutput(stdout);

        resolve({
          exitCode: exitCode != null ? exitCode : -1,
          stdout,
          stderr,
          durationSeconds: duration,
          tokensUsed: tokens,
          costUsd: cost,
        });
      });

      proc.on('exit', (exitCode, signal) => {
        // Timeout fallback: if process is killed by signal
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          // Already handled by 'close', but guard here
        }
      });
    });
  }

  isAvailable() {
    return !!require('child_process').spawnSync('which', ['claude'], { stdio: 'pipe' }).stdout.toString().trim();
  }
}

module.exports = { ClaudeCodeAdapter };
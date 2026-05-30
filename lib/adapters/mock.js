'use strict';

const { AgentAdapter } = require('./base');
const crypto = require('crypto');

/**
 * Deterministic mock adapter for testing.
 */
class MockAdapter extends AgentAdapter {
  name = 'mock';

  /**
   * @param {object} opts
   * @param {number} [opts.passRate=0.8]
   * @param {number} [opts.avgDuration=5.0]
   * @param {number} [opts.avgTokens=1000]
   */
  constructor(opts = {}) {
    super();
    this.passRate = opts.passRate != null ? opts.passRate : 0.8;
    this.avgDuration = opts.avgDuration != null ? opts.avgDuration : 5.0;
    this.avgTokens = opts.avgTokens != null ? opts.avgTokens : 1000;
  }

  /**
   * @param {import('../task').Task} task
   * @param {string} workdir
   * @returns {Promise<import('./base').AgentRunResult>}
   */
  async run(task, workdir) {
    const h = parseInt(crypto.createHash('md5').update(task.id).digest('hex').slice(0, 8), 16);
    const passed = (h % 100) < (this.passRate * 100);

    const durationFactor = 0.8 + (h % 40) / 100.0;
    const duration = Math.round(this.avgDuration * durationFactor * 100) / 100;

    await sleep(10);

    const tokenFactor = 0.7 + (h % 60) / 100.0;
    const tokens = Math.floor(this.avgTokens * tokenFactor);
    const cost = Math.round(tokens * 0.000003 * 1e6) / 1e6;

    return {
      exitCode: passed ? 0 : 1,
      stdout: `Mock output for task ${task.id}`,
      stderr: passed ? '' : 'Mock error',
      durationSeconds: duration,
      tokensUsed: tokens,
      costUsd: cost,
    };
  }

  isAvailable() {
    return true;
  }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { MockAdapter };
'use strict';

/**
 * Abstract base class for coding agent adapters.
 */
class AgentAdapter {
  /** @type {string} */
  name = 'base';

  /**
   * Run the agent on a task in the given working directory.
   * @param {import('../task').Task} task
   * @param {string} workdir
   * @returns {Promise<AgentRunResult>}
   */
  async run(task, workdir) {
    throw new Error('Not implemented');
  }

  /**
   * Check if the agent CLI is installed and accessible.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }
}

module.exports = { AgentAdapter };

/**
 * @typedef {object} AgentRunResult
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} durationSeconds
 * @property {number|null} tokensUsed
 * @property {number|null} costUsd
 */
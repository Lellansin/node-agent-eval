'use strict';

const { execSync, spawn } = require('child_process');

/**
 * Judge whether an agent completed the task successfully.
 *
 * Strategy:
 * 1. If task.testCmd is set, run it and check exit code.
 * 2. If task.judgePrompt is set, use LLM-as-judge (future).
 * 3. If neither, return passed=true (manual review needed).
 *
 * @param {import('./models').Task} task
 * @param {string} workdir
 * @returns {Promise<{passed: boolean, exitCode: number}>}
 */
async function judgeRun(task, workdir) {
  if (task.testCmd) {
    return runTestCmd(task.testCmd, workdir, task.timeoutSeconds);
  }

  if (task.judgePrompt) {
    // Future: LLM-as-judge evaluation
    return { passed: true, exitCode: 0 };
  }

  // No test criteria — assume manual review
  return { passed: true, exitCode: 0 };
}

/**
 * Run a test command and return pass/fail.
 * @param {string} cmd
 * @param {string} workdir
 * @param {number} timeoutSeconds
 * @returns {Promise<{passed: boolean, exitCode: number}>}
 */
function runTestCmd(cmd, workdir, timeoutSeconds) {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      cwd: workdir,
      stdio: 'pipe',
      timeout: timeoutSeconds * 1000,
    });

    proc.on('close', (code) => {
      const exitCode = code != null ? code : -1;
      resolve({ passed: exitCode === 0, exitCode });
    });

    proc.on('error', () => {
      resolve({ passed: false, exitCode: -1 });
    });
  });
}

module.exports = { judgeRun, runTestCmd };
'use strict';

const path = require('path');
const { withIsolatedWorkdir } = require('./isolation');
const { judgeRun } = require('./judge');
const { generateReport } = require('./report');

/**
 * Run all agents on all tasks and collect results.
 *
 * For each (agent, task, runIndex):
 * 1. Create isolated worktree
 * 2. Run agent
 * 3. Judge result
 * 4. Collect metrics
 *
 * @param {import('./models').TaskSuite} suite
 * @param {import('./adapters/base').AgentAdapter[]} agents
 * @param {object} opts
 * @param {number} [opts.runsPerTask=1]
 * @param {number} [opts.concurrency=1]
 * @returns {Promise<import('./models').EvalReport>}
 */
async function runEval(suite, agents, opts = {}) {
  const runsPerTask = opts.runsPerTask || 1;
  const concurrency = opts.concurrency || 1;

  // Build work queue
  /** @type {Array<{agent: import('./adapters/base').AgentAdapter, task: import('./models').Task, runIndex: number}>} */
  const workItems = [];
  for (const agent of agents) {
    for (const task of suite.tasks) {
      for (let i = 0; i < runsPerTask; i++) {
        workItems.push({ agent, task, runIndex: i });
      }
    }
  }

  // Process with concurrency limit
  /** @type {import('./models').RunResult[]} */
  const allResults = [];
  const inFlight = new Set();
  let idx = 0;

  return new Promise((resolve) => {
    function scheduleNext() {
      while (inFlight.size < concurrency && idx < workItems.length) {
        const item = workItems[idx++];
        const promise = runSingle(item.agent, item.task, item.runIndex);
        inFlight.add(promise);
        promise.then((result) => {
          allResults.push(result);
          inFlight.delete(promise);
          if (inFlight.size === 0 && idx >= workItems.length) {
            const agentNames = agents.map((a) => a.name);
            resolve(generateReport(allResults, suite, agentNames));
          } else {
            scheduleNext();
          }
        });
      }
    }
    scheduleNext();
  });
}

/**
 * Run a single agent on a single task.
 * @param {import('./adapters/base').AgentAdapter} agent
 * @param {import('./models').Task} task
 * @param {number} runIndex
 * @returns {Promise<import('./models').RunResult>}
 */
async function runSingle(agent, task, runIndex) {
  const repoPath = path.resolve(task.repo);

  try {
    let result = null;
    await withIsolatedWorkdir(repoPath, task.ref, async (workdir) => {
      // Run the agent
      const agentResult = await agent.run(task, workdir);

      // Judge the result
      const { passed } = await judgeRun(task, workdir);

      result = {
        taskId: task.id,
        agent: agent.name,
        runIndex,
        passed: agentResult.exitCode === 0 ? passed : false,
        exitCode: agentResult.exitCode,
        durationSeconds: agentResult.durationSeconds,
        tokensUsed: agentResult.tokensUsed != null ? agentResult.tokensUsed : null,
        costUsd: agentResult.costUsd != null ? agentResult.costUsd : null,
        stdout: agentResult.stdout || '',
        stderr: agentResult.stderr || '',
        error: null,
      };
    });

    return result;
  } catch (e) {
    return {
      taskId: task.id,
      agent: agent.name,
      runIndex,
      passed: false,
      exitCode: -1,
      durationSeconds: 0,
      tokensUsed: null,
      costUsd: null,
      stdout: '',
      stderr: '',
      error: `${e.constructor.name}: ${e.message}`,
    };
  }
}

module.exports = { runEval, runSingle };
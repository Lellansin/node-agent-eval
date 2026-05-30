'use strict';

/**
 * Generate comparison report from evaluation results.
 *
 * @param {import('./models').RunResult[]} results
 * @param {import('./models').TaskSuite} suite
 * @param {string[]} agents
 * @returns {import('./models').EvalReport}
 */
function generateReport(results, suite, agents) {
  /** @type {import('./models').AgentScore[]} */
  const scores = [];
  for (const agent of agents) {
    const agentResults = results.filter((r) => r.agent === agent);
    scores.push(computeAgentScore(agent, agentResults));
  }

  const summary = buildSummary(scores);

  return {
    suiteName: suite.name,
    timestamp: new Date().toISOString(),
    agents,
    scores,
    results,
    summary,
  };
}

/**
 * Compute aggregate score for a single agent.
 * @param {string} agent
 * @param {import('./models').RunResult[]} results
 * @returns {import('./models').AgentScore}
 */
function computeAgentScore(agent, results) {
  if (results.length === 0) {
    return {
      agent,
      tasksAttempted: 0,
      tasksPassed: 0,
      passRate: 0,
      avgDurationSeconds: 0,
      avgCostUsd: null,
      totalTokens: null,
      consistency: null,
    };
  }

  const tasksAttempted = results.length;
  const tasksPassed = results.filter((r) => r.passed).length;
  const passRate = tasksAttempted > 0 ? tasksPassed / tasksAttempted : 0;
  const avgDuration = results.reduce((sum, r) => sum + r.durationSeconds, 0) / tasksAttempted;

  const costResults = results.filter((r) => r.costUsd != null);
  const avgCost = costResults.length > 0
    ? costResults.reduce((sum, r) => sum + /** @type {number} */ (r.costUsd), 0) / costResults.length
    : null;

  const tokenResults = results.filter((r) => r.tokensUsed != null);
  const totalTokens = tokenResults.length > 0
    ? tokenResults.reduce((sum, r) => sum + /** @type {number} */ (r.tokensUsed), 0)
    : null;

  const consistency = computeConsistency(results);

  return {
    agent,
    tasksAttempted,
    tasksPassed,
    passRate: round(passRate, 4),
    avgDurationSeconds: round(avgDuration, 2),
    avgCostUsd: avgCost != null ? round(avgCost, 6) : null,
    totalTokens,
    consistency: consistency != null ? round(consistency, 4) : null,
  };
}

/**
 * Compute consistency as 1 - std_dev of per-task pass rates.
 * @param {import('./models').RunResult[]} results
 * @returns {number|null}
 */
function computeConsistency(results) {
  /** @type {Record<string, import('./models').RunResult[]>} */
  const byTask = {};
  for (const r of results) {
    if (!byTask[r.taskId]) byTask[r.taskId] = [];
    byTask[r.taskId].push(r);
  }

  const taskRates = [];
  for (const taskResults of Object.values(byTask)) {
    if (taskResults.length >= 1) {
      const rate = taskResults.filter((r) => r.passed).length / taskResults.length;
      taskRates.push(rate);
    }
  }

  if (taskRates.length < 2) return null;

  const mean = taskRates.reduce((a, b) => a + b, 0) / taskRates.length;
  const variance = taskRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / taskRates.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, 1 - stdDev);
}

/**
 * @param {import('./models').AgentScore[]} scores
 * @returns {string}
 */
function buildSummary(scores) {
  if (scores.length === 0) return 'No agents evaluated.';

  const lines = [];

  const best = scores.reduce((a, b) => a.passRate > b.passRate ? a : b);
  lines.push(`Best pass rate: ${best.agent} (${(best.passRate * 100).toFixed(0)}%)`);

  const fastest = scores.reduce((a, b) => a.avgDurationSeconds < b.avgDurationSeconds ? a : b);
  lines.push(`Fastest: ${fastest.agent} (${fastest.avgDurationSeconds.toFixed(1)}s avg)`);

  const withCost = scores.filter((s) => s.avgCostUsd != null);
  if (withCost.length > 0) {
    const cheapest = withCost.reduce((a, b) => (a.avgCostUsd || 0) < (b.avgCostUsd || 0) ? a : b);
    lines.push(`Cheapest: ${cheapest.agent} ($${(cheapest.avgCostUsd || 0).toFixed(4)} avg)`);
  }

  return lines.join(' | ');
}

/**
 * Print a formatted comparison table to the terminal.
 * @param {import('./models').EvalReport} report
 */
function printReport(report) {
  const header = `${'Agent'.padEnd(15)} ${'Pass Rate'.padStart(10)} ${'Avg Time'.padStart(10)} ${'Avg Cost'.padStart(10)} ${'Consistency'.padStart(12)}`;
  const separator = '-'.repeat(header.length);

  console.log(`\n${report.suiteName}`);
  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const score of report.scores) {
    const passRate = `${(score.passRate * 100).toFixed(0)}%`;
    const avgTime = `${score.avgDurationSeconds.toFixed(1)}s`;
    const avgCost = score.avgCostUsd != null ? `$${score.avgCostUsd.toFixed(4)}` : 'N/A';
    const consistency = score.consistency != null ? score.consistency.toFixed(2) : 'N/A';
    console.log(`${score.agent.padEnd(15)} ${passRate.padStart(10)} ${avgTime.padStart(10)} ${avgCost.padStart(10)} ${consistency.padStart(12)}`);
  }

  console.log(separator);
  console.log(report.summary);
  console.log();
}

/**
 * Serialize report to JSON string.
 * @param {import('./models').EvalReport} report
 * @returns {string}
 */
function toJson(report) {
  return JSON.stringify(report, null, 2);
}

/**
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

module.exports = { generateReport, computeAgentScore, printReport, toJson };
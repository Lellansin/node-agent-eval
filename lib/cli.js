'use strict';

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { loadTaskSuite } = require('./task');
const { runEval } = require('./runner');
const { printReport, toJson } = require('./report');
const { getAdapter, listAdapters } = require('./adapters');

const VERSION = '0.1.0';

/**
 * CLI entry point.
 */
function main() {
  const program = new Command();

  program
    .name('agent-eval')
    .description('Compare coding agents head-to-head on custom tasks.')
    .version(VERSION);

  // agent-eval run
  program
    .command('run')
    .description('Run evaluation')
    .requiredOption('--tasks <path>', 'Path to tasks YAML file')
    .requiredOption('--agents <names>', 'Comma-separated agent names')
    .option('--runs <number>', 'Runs per task per agent', '1')
    .option('--concurrency <number>', 'Concurrent agent runs', '1')
    .option('--output <path>', 'Output JSON path')
    .action(async (opts) => {
      await cmdRun(opts);
    });

  // agent-eval report
  program
    .command('report')
    .description('Display report from JSON')
    .requiredOption('--input <path>', 'Path to report JSON')
    .action((opts) => {
      cmdReport(opts);
    });

  // agent-eval list-agents
  program
    .command('list-agents')
    .description('List available agent adapters')
    .action(() => {
      cmdListAgents();
    });

  program.parse(process.argv);
}

/**
 * Run command handler.
 * @param {object} opts
 */
async function cmdRun(opts) {
  const suite = loadTaskSuite(opts.tasks);
  const agentNames = opts.agents.split(',').map((s) => s.trim());

  const agents = [];
  for (const name of agentNames) {
    const adapter = getAdapter(name);
    if (!adapter.isAvailable()) {
      console.error(`Warning: agent '${name}' is not available (CLI not found)`);
    }
    agents.push(adapter);
  }

  if (agents.length === 0) {
    console.error('Error: no agents specified');
    process.exit(1);
  }

  const runsPerTask = parseInt(opts.runs, 10) || 1;
  const concurrency = parseInt(opts.concurrency, 10) || 1;

  const report = await runEval(suite, agents, { runsPerTask, concurrency });

  printReport(report);

  if (opts.output) {
    fs.writeFileSync(opts.output, toJson(report), 'utf8');
    console.log(`Report saved to ${opts.output}`);
  }
}

/**
 * Report command handler.
 * @param {object} opts
 */
function cmdReport(opts) {
  const raw = fs.readFileSync(opts.input, 'utf8');
  const report = JSON.parse(raw);
  printReport(report);
}

/**
 * List agents command handler.
 */
function cmdListAgents() {
  console.log(`${'Agent'.padEnd(15)} ${'Available'.padStart(10)}`);
  console.log('-'.repeat(25));
  for (const info of listAdapters()) {
    const status = info.available ? 'yes' : 'no';
    console.log(`${info.name.padEnd(15)} ${status.padStart(10)}`);
  }
}

module.exports = { main };
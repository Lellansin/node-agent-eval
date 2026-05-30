'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { MockAdapter } = require('../lib/adapters/mock');
const { runEval } = require('../lib/runner');
const { loadTaskSuite } = require('../lib/task');
const { parseClaudeCodeOutput, parseAiderOutput, estimateCost } = require('../lib/cost');
const { judgeRun, runTestCmd } = require('../lib/judge');
const { generateReport, printReport, toJson } = require('../lib/report');
const { withIsolatedWorkdir } = require('../lib/isolation');
const { getAdapter, listAdapters } = require('../lib/adapters');
const { execSync } = require('child_process');

// ─── Task Loading ─────────────────────────────────────────────

describe('loadTaskSuite', () => {
  it('loads valid YAML task file', () => {
    const suite = loadTaskSuite(path.join(__dirname, '..', 'examples', 'tasks.yaml'));
    assert.equal(suite.name, 'Sample Evaluation Suite');
    assert.equal(suite.tasks.length, 3);
    assert.equal(suite.tasks[0].id, 'hello-world');
    assert.equal(suite.tasks[0].timeoutSeconds, 60);
  });

  it('throws on missing file', () => {
    assert.throws(() => loadTaskSuite('/nonexistent/path.yaml'), /Task file not found/);
  });

  it('throws on missing name field', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-test-'));
    const file = path.join(dir, 'bad.yaml');
    fs.writeFileSync(file, 'tasks: []');
    assert.throws(() => loadTaskSuite(file), /Missing required field 'name'/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles snake_case and camelCase field aliases', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-test-'));
    const file = path.join(dir, 'test.yaml');
    fs.writeFileSync(file, `name: "Test"\ntasks:\n  - id: t1\n    description: "test"\n    repo: .\n    test_cmd: "echo ok"\n    timeout_seconds: 120\n`);
    const suite = loadTaskSuite(file);
    assert.equal(suite.tasks[0].testCmd, 'echo ok');
    assert.equal(suite.tasks[0].timeoutSeconds, 120);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── Cost Parsing ─────────────────────────────────────────────

describe('cost parsing', () => {
  it('parseClaudeCodeOutput extracts tokens and cost', () => {
    const json = JSON.stringify({
      usage: { input_tokens: 100, output_tokens: 50 },
      cost_usd: 0.00045,
    });
    const result = parseClaudeCodeOutput(json);
    assert.equal(result.tokens, 150);
    assert.equal(result.cost, 0.00045);
  });

  it('parseClaudeCodeOutput handles missing data', () => {
    assert.deepEqual(parseClaudeCodeOutput(''), { tokens: null, cost: null });
    assert.deepEqual(parseClaudeCodeOutput('not json'), { tokens: null, cost: null });
  });

  it('parseAiderOutput extracts tokens with k suffix', () => {
    const output = 'Tokens: 1,200 sent, 800 received. Cost: $0.01';
    const result = parseAiderOutput(output);
    assert.ok(result.tokens > 0);
    assert.equal(result.cost, 0.01);
  });

  it('estimateCost calculates correctly', () => {
    const cost = estimateCost(1000000, 'claude-sonnet-4-20250514');
    assert.ok(cost > 0);
    assert.equal(cost, 3); // 1M tokens x 0.000003 = $3
  });
});

// ─── Judge ────────────────────────────────────────────────────

describe('judgeRun', () => {
  it('returns passed=true when test cmd exits 0', async () => {
    const task = { id: 'test', description: '', repo: '.', testCmd: 'true', timeoutSeconds: 5, ref: 'HEAD', judgePrompt: null, tags: [] };
    const cwd = process.cwd();
    const result = await judgeRun(task, cwd);
    assert.equal(result.passed, true);
    assert.equal(result.exitCode, 0);
  });

  it('returns passed=false when test cmd exits non-zero', async () => {
    const task = { id: 'test', description: '', repo: '.', testCmd: 'exit 1', timeoutSeconds: 5, ref: 'HEAD', judgePrompt: null, tags: [] };
    const result = await judgeRun(task, process.cwd());
    assert.equal(result.passed, false);
    assert.equal(result.exitCode, 1);
  });

  it('returns passed=true when no test criteria (manual review)', async () => {
    const task = { id: 'test', description: '', repo: '.', testCmd: null, timeoutSeconds: 5, ref: 'HEAD', judgePrompt: null, tags: [] };
    const result = await judgeRun(task, process.cwd());
    assert.equal(result.passed, true);
  });
});

// ─── Report ───────────────────────────────────────────────────

describe('report', () => {
  it('generates valid report from results', () => {
    const results = [
      { taskId: 't1', agent: 'mock', runIndex: 0, passed: true, exitCode: 0, durationSeconds: 5.0, tokensUsed: 1000, costUsd: 0.003, stdout: '', stderr: '', error: null },
      { taskId: 't2', agent: 'mock', runIndex: 0, passed: false, exitCode: 1, durationSeconds: 4.0, tokensUsed: 800, costUsd: 0.0024, stdout: '', stderr: '', error: null },
    ];
    const suite = { name: 'Test', description: '', tasks: [] };
    const report = generateReport(results, suite, ['mock']);
    assert.equal(report.scores.length, 1);
    assert.equal(report.scores[0].passRate, 0.5);
    assert.equal(report.scores[0].tasksAttempted, 2);
    assert.ok(report.summary.includes('mock'));
  });

  it('toJson produces valid JSON', () => {
    const report = {
      suiteName: 'T', timestamp: new Date().toISOString(), agents: ['mock'],
      scores: [], results: [], summary: 'ok',
    };
    const json = toJson(report);
    assert.ok(JSON.parse(json));
  });

  it('printReport does not throw', () => {
    const report = {
      suiteName: 'T', timestamp: new Date().toISOString(), agents: ['mock'],
      scores: [{ agent: 'mock', tasksAttempted: 1, tasksPassed: 1, passRate: 1, avgDurationSeconds: 5, avgCostUsd: 0.003, totalTokens: 1000, consistency: 1 }],
      results: [], summary: 'ok',
    };
    // Should not throw
    printReport(report);
  });
});

// ─── Adapters ─────────────────────────────────────────────────

describe('adapters', () => {
  it('getAdapter returns correct type', () => {
    const adapter = getAdapter('mock');
    assert.equal(adapter.name, 'mock');
    assert.equal(adapter.isAvailable(), true);
  });

  it('getAdapter throws on unknown', () => {
    assert.throws(() => getAdapter('nonexistent'), /Unknown agent adapter/);
  });

  it('listAdapters returns all registered', () => {
    const list = listAdapters();
    assert.ok(list.length >= 3);
    assert.ok(list.some((a) => a.name === 'claude-code'));
    assert.ok(list.some((a) => a.name === 'aider'));
    assert.ok(list.some((a) => a.name === 'mock'));
  });

  it('mock adapter produces deterministic results', async () => {
    const adapter = new MockAdapter({ passRate: 1.0 });
    const task = { id: 'test', description: 'test', repo: '.', ref: 'HEAD', testCmd: null, judgePrompt: null, timeoutSeconds: 60, tags: [] };
    const result = await adapter.run(task, process.cwd());
    assert.equal(result.exitCode, 0);
    assert.ok(result.durationSeconds > 0);
    assert.ok(result.tokensUsed > 0);
    assert.ok(result.costUsd > 0);
  });
});

// ─── E2E with Mock ────────────────────────────────────────────

async function createTmpGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-test-'));
  process.chdir(dir);
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test Repo\n');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  process.chdir(__dirname);
  return dir;
}

describe('E2E runner', () => {
  it('runs mock adapter and produces valid report', async () => {
    const originalCwd = process.cwd();
    const repo = await createTmpGitRepo();

    try {
      const suite = {
        name: 'E2E Test',
        description: '',
        tasks: [
          { id: 't1', description: 'task one', repo, ref: 'HEAD', testCmd: 'true', judgePrompt: null, timeoutSeconds: 60, tags: [] },
          { id: 't2', description: 'task two', repo, ref: 'HEAD', testCmd: 'true', judgePrompt: null, timeoutSeconds: 60, tags: [] },
        ],
      };
      const agents = [new MockAdapter({ passRate: 1.0 })];
      const report = await runEval(suite, agents, { runsPerTask: 1 });

      assert.equal(report.suiteName, 'E2E Test');
      assert.equal(report.results.length, 2);
      assert.equal(report.scores.length, 1);
      assert.equal(report.scores[0].agent, 'mock');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('correct result count = agents x tasks x runs', async () => {
    const originalCwd = process.cwd();
    const repo = await createTmpGitRepo();

    try {
      const suite = {
        name: 'E2E Test',
        description: '',
        tasks: [
          { id: 't1', description: 'task one', repo, ref: 'HEAD', testCmd: 'true', judgePrompt: null, timeoutSeconds: 60, tags: [] },
          { id: 't2', description: 'task two', repo, ref: 'HEAD', testCmd: 'true', judgePrompt: null, timeoutSeconds: 60, tags: [] },
        ],
      };
      const agent1 = new MockAdapter({ passRate: 1.0 });
      const agent2 = new MockAdapter({ passRate: 0.5 });
      agent2.name = 'mock-2';
      const report = await runEval(suite, [agent1, agent2], { runsPerTask: 2 });

      // 2 agents x 2 tasks x 2 runs = 8
      assert.equal(report.results.length, 8);
      assert.equal(report.agents.length, 2);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
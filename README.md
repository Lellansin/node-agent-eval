# node-agent-eval

Compare coding agents head-to-head. Pass rate, cost, time, consistency — one command.

## The problem

Every "which coding agent is best?" discussion runs on vibes. There's no lightweight tool to systematically compare agents on **your** tasks, with **your** codebase, tracking what actually matters: does it work, how long did it take, and what did it cost?

## Quickstart

```bash
npm i -g node-agent-eval

node-agent-eval run --tasks examples/tasks.yaml --agents claude-code,mock --runs 3
node-agent-eval report --input report.json
node-agent-eval list-agents
```

## Example output

```
Sample Evaluation Suite
-------------------------------------------------------------------
Agent            Pass Rate   Avg Time   Avg Cost   Consistency
-------------------------------------------------------------------
claude-code           80%      45.2s    $0.1200         0.95
aider                 60%      30.1s    $0.0300         0.85
-------------------------------------------------------------------
Best pass rate: claude-code (80%) | Fastest: aider (30.1s avg) | Cheapest: aider ($0.0300 avg)
```

## How it works

1. **Define tasks** in YAML — description, repo, test command, timeout
2. **Isolated execution** — each agent runs in a fresh git worktree (no Docker needed)
3. **Run agents** — Claude Code, Aider, or any CLI agent via adapters
4. **Judge results** — test commands (exit 0 = pass) or LLM-as-judge
5. **Report** — pass rate, avg time, avg cost, consistency across runs

## Supported agents

| Agent | CLI | Status |
|-------|-----|--------|
| Claude Code | `claude` | Supported |
| Aider | `aider` | Supported |
| Mock | built-in | For testing |
| Custom | Extend `AgentAdapter` | Extensible |

## Task format

```yaml
name: "My Eval Suite"
description: "Example tasks"
tasks:
  - id: add-auth
    description: "Add JWT auth middleware to the Flask app"
    repo: "./my-flask-app"
    test_cmd: "python -m pytest tests/ -v"
    timeout_seconds: 180
    tags: [python, auth]

  - id: fix-csv-parser
    description: "Fix the CSV parser to handle empty input gracefully"
    repo: "./my-flask-app"
    test_cmd: "python test_csv.py"
    timeout_seconds: 120
    tags: [python, bugfix]
```

### Field reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | yes | — | Unique task identifier |
| `description` | yes | — | Prompt given to the agent |
| `repo` | yes | — | Path to the git repository |
| `ref` | no | `HEAD` | Git ref to check out |
| `test_cmd` | no | — | Shell command; exit 0 = pass |
| `judge_prompt` | no | — | LLM-as-judge prompt (future) |
| `timeout_seconds` | no | `300` | Max execution time |
| `tags` | no | `[]` | Arbitrary string tags |

## CLI reference

```
node-agent-eval <command> [options]

Commands:
  run          Run evaluation
  report       Display report from JSON
  list-agents  List available agent adapters

Run options:
  --tasks <path>         Path to tasks YAML file (required)
  --agents <names>       Comma-separated agent names (required)
  --runs <number>        Runs per task per agent (default: 1)
  --concurrency <number> Concurrent agent runs (default: 1)
  --output <path>        Output JSON path

Report options:
  --input <path>         Path to report JSON (required)
```

## Metrics

| Metric | What it measures |
|--------|-----------------|
| **Pass Rate** | Did the agent produce code that passes the judge? |
| **Avg Time** | Average wall-clock seconds to completion |
| **Avg Cost** | Average API spend per task (when available) |
| **Consistency** | 1 - std_dev of per-task pass rates across repeated runs |

## Extending with custom adapters

```js
const { AgentAdapter } = require('node-agent-eval/lib/adapters/base');
const { spawn } = require('child_process');

class MyAgent extends AgentAdapter {
  name = 'my-agent';

  async run(task, workdir) {
    // Spawn your agent CLI, return { exitCode, stdout, stderr, durationSeconds, tokensUsed, costUsd }
  }

  isAvailable() {
    return true;
  }
}

module.exports = { MyAgent };
```

## vs SWE-bench

| | SWE-bench | node-agent-eval |
|---|-----------|-----------------|
| Tasks | Fixed dataset (GitHub issues) | Your custom tasks |
| Setup | Docker, heavy infra | Git worktrees, no Docker |
| Cost tracking | No | Yes |
| Consistency measurement | No (1 run) | Yes (N runs, std dev) |
| Time to first result | Hours | Minutes |

## License

MIT
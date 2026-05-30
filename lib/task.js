'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load and validate a task suite from a YAML file.
 * @param {string} filePath - Path to the YAML file
 * @returns {import('./models').TaskSuite}
 * @throws {Error} If file not found or YAML is invalid
 */
function loadTaskSuite(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Task file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  let data;
  try {
    data = yaml.load(raw);
  } catch (e) {
    throw new Error(`Invalid YAML in ${filePath}: ${e.message}`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`Expected a mapping at top level in ${filePath}, got ${typeof data}`);
  }

  if (!data.name) {
    throw new Error(`Missing required field 'name' in ${filePath}`);
  }

  if (!Array.isArray(data.tasks)) {
    throw new Error(`Missing or invalid 'tasks' field in ${filePath}`);
  }

  /** @type {import('./models').Task[]} */
  const tasks = data.tasks.map((taskData, i) => {
    if (!taskData || typeof taskData !== 'object') {
      throw new Error(`Task ${i} must be a mapping, got ${typeof taskData}`);
    }
    if (!taskData.id) {
      throw new Error(`Task ${i} is missing required field 'id'`);
    }
    if (!taskData.description) {
      throw new Error(`Task ${i} (${taskData.id}) is missing required field 'description'`);
    }
    if (!taskData.repo) {
      throw new Error(`Task ${i} (${taskData.id}) is missing required field 'repo'`);
    }

    return {
      id: taskData.id,
      description: taskData.description,
      repo: taskData.repo,
      ref: taskData.ref || 'HEAD',
      testCmd: taskData.test_cmd || taskData.testCmd || null,
      judgePrompt: taskData.judge_prompt || taskData.judgePrompt || null,
      timeoutSeconds: taskData.timeout_seconds || taskData.timeoutSeconds || 300,
      tags: taskData.tags || [],
    };
  });

  return {
    name: data.name,
    description: data.description || '',
    tasks,
  };
}

module.exports = { loadTaskSuite };
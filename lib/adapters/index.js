'use strict';

const { ClaudeCodeAdapter } = require('./claude-code');
const { AiderAdapter } = require('./aider');
const { MockAdapter } = require('./mock');

/** @type {Record<string, new () => import('./base').AgentAdapter>} */
const ADAPTERS = {
  'claude-code': ClaudeCodeAdapter,
  'aider': AiderAdapter,
  'mock': MockAdapter,
};

/**
 * Get an adapter instance by name.
 * @param {string} name
 * @returns {import('./base').AgentAdapter}
 */
function getAdapter(name) {
  const Cls = ADAPTERS[name];
  if (!Cls) {
    throw new Error(`Unknown agent adapter: '${name}'. Available: ${Object.keys(ADAPTERS).join(', ')}`);
  }
  return new Cls();
}

/**
 * List all registered adapters with availability status.
 * @returns {Array<{name: string, available: boolean}>}
 */
function listAdapters() {
  return Object.entries(ADAPTERS).map(([name, Cls]) => ({
    name,
    available: new Cls().isAvailable(),
  }));
}

module.exports = { getAdapter, listAdapters, ADAPTERS };
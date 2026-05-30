'use strict';

/**
 * Pricing per token (input/output averaged) for common models.
 * @type {Record<string, number>}
 */
const MODEL_PRICING = {
  'claude-sonnet-4-20250514': 0.000003,   // ~$3/M tokens blended
  'claude-opus-4-20250514': 0.000015,     // ~$15/M tokens blended
  'claude-haiku-3.5': 0.0000008,          // ~$0.80/M tokens blended
  'gpt-4o': 0.0000025,                    // ~$2.50/M tokens blended
  'gpt-4o-mini': 0.00000015,              // ~$0.15/M tokens blended
};

/**
 * Parse Claude Code JSON output for token usage and cost.
 * @param {string} output
 * @returns {{tokens: number|null, cost: number|null}}
 */
function parseClaudeCodeOutput(output) {
  if (!output || !output.trim()) {
    return { tokens: null, cost: null };
  }

  let data;
  try {
    data = JSON.parse(output);
  } catch (_) {
    return { tokens: null, cost: null };
  }

  if (!data || typeof data !== 'object') {
    return { tokens: null, cost: null };
  }

  let tokens = null;
  let cost = null;

  if (data.usage && typeof data.usage === 'object') {
    const inputTokens = data.usage.input_tokens || 0;
    const outputTokens = data.usage.output_tokens || 0;
    tokens = inputTokens + outputTokens;
  }

  if (tokens == null && data.total_tokens != null) {
    tokens = data.total_tokens;
  }

  if (data.cost_usd != null) {
    cost = data.cost_usd;
  } else if (data.cost != null) {
    cost = data.cost;
  }

  return { tokens, cost };
}

/**
 * Parse Aider output for token usage and cost.
 * @param {string} output
 * @returns {{tokens: number|null, cost: number|null}}
 */
function parseAiderOutput(output) {
  if (!output) {
    return { tokens: null, cost: null };
  }

  let tokens = null;
  let cost = null;

  // Match: "Tokens: X sent, Y received" with optional 'k' suffix
  const tokenPattern = /Tokens:\s*([\d,.]+)k?\s*sent,\s*([\d,.]+)k?\s*received/i;
  const tokenMatch = output.match(tokenPattern);
  if (tokenMatch) {
    const sentStr = tokenMatch[1].replace(/,/g, '');
    const recvStr = tokenMatch[2].replace(/,/g, '');
    let sent = parseFloat(sentStr);
    let recv = parseFloat(recvStr);

    const fullMatch = tokenMatch[0];
    if (fullMatch.includes('k sent')) sent *= 1000;
    if (fullMatch.includes('k received')) recv *= 1000;

    if (!isNaN(sent) && !isNaN(recv)) {
      tokens = Math.floor(sent + recv);
    }
  }

  // Match: "Cost: $X.XX"
  const costPattern = /Cost:\s*\$([\d.]+)/i;
  const costMatch = output.match(costPattern);
  if (costMatch) {
    const c = parseFloat(costMatch[1]);
    if (!isNaN(c)) cost = c;
  }

  return { tokens, cost };
}

/**
 * Estimate cost from token count using known pricing.
 * @param {number} tokens
 * @param {string} [model='claude-sonnet-4-20250514']
 * @returns {number}
 */
function estimateCost(tokens, model = 'claude-sonnet-4-20250514') {
  const pricePerToken = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-20250514'];
  return Math.round(tokens * pricePerToken * 1e6) / 1e6;
}

module.exports = { parseClaudeCodeOutput, parseAiderOutput, estimateCost, MODEL_PRICING };
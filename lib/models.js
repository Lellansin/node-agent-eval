'use strict';

/**
 * Task definition data model.
 *
 * @typedef {object} Task
 * @property {string} id
 * @property {string} description
 * @property {string} repo
 * @property {string} [ref='HEAD']
 * @property {string|null} [testCmd=null]
 * @property {string|null} [judgePrompt=null]
 * @property {number} [timeoutSeconds=300]
 * @property {string[]} [tags=[]]
 */

/**
 * Task suite data model.
 *
 * @typedef {object} TaskSuite
 * @property {string} name
 * @property {string} [description='']
 * @property {Task[]} tasks
 */

/**
 * Run result data model.
 *
 * @typedef {object} RunResult
 * @property {string} taskId
 * @property {string} agent
 * @property {number} runIndex
 * @property {boolean} passed
 * @property {number} exitCode
 * @property {number} durationSeconds
 * @property {number|null} [tokensUsed=null]
 * @property {number|null} [costUsd=null]
 * @property {string} [stdout='']
 * @property {string} [stderr='']
 * @property {string|null} [error=null]
 */

/**
 * Agent score data model.
 *
 * @typedef {object} AgentScore
 * @property {string} agent
 * @property {number} tasksAttempted
 * @property {number} tasksPassed
 * @property {number} passRate
 * @property {number} avgDurationSeconds
 * @property {number|null} avgCostUsd
 * @property {number|null} totalTokens
 * @property {number|null} consistency
 */

/**
 * Eval report data model.
 *
 * @typedef {object} EvalReport
 * @property {string} suiteName
 * @property {string} timestamp
 * @property {string[]} agents
 * @property {AgentScore[]} scores
 * @property {RunResult[]} results
 * @property {string} summary
 */

module.exports = {};
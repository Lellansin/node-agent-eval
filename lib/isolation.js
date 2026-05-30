'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create an isolated git worktree for an agent run.
 *
 * Uses git worktree to create a cheap, isolated copy of the repo
 * at the specified ref. Cleans up after the callback completes.
 *
 * @param {string} repoPath - Path to the git repository
 * @param {string} ref - Git ref to check out
 * @param {function(string): Promise<void>} callback - Called with workdir path
 * @returns {Promise<void>}
 */
async function withIsolatedWorkdir(repoPath, ref, callback) {
  const absPath = path.resolve(repoPath);
  const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-eval-'));

  try {
    execSync(
      `git worktree add --detach "${worktreeDir}" ${ref}`,
      { cwd: absPath, stdio: 'pipe' }
    );
    await callback(worktreeDir);
  } finally {
    // Remove worktree registration
    try {
      execSync(
        `git worktree remove --force "${worktreeDir}"`,
        { cwd: absPath, stdio: 'pipe' }
      );
    } catch (_) {
      // Ignore cleanup errors
    }
    // Belt-and-suspenders: remove the directory
    try {
      fs.rmSync(worktreeDir, { recursive: true, force: true });
    } catch (_) {
      // Ignore
    }
  }
}

/**
 * Create an isolated git worktree (async context manager equivalent).
 *
 * Usage:
 *   await usingWorktree(repoPath, ref, async (workdir) => {
 *     // work in isolated directory
 *   });
 *
 * @param {string} repoPath
 * @param {string} ref
 * @param {function(string): Promise<void>} fn
 * @returns {Promise<void>}
 */
async function usingWorktree(repoPath, ref, fn) {
  return withIsolatedWorkdir(repoPath, ref, fn);
}

module.exports = { withIsolatedWorkdir, usingWorktree };
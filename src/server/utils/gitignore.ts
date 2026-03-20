/**
 * Utilities for loading and parsing .gitignore files
 */
import ignore, { type Ignore } from 'ignore'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import type { FastifyBaseLogger } from 'fastify'

/** Optional logger interface for warning about gitignore issues */
type Logger = Pick<FastifyBaseLogger, 'warn'>

/**
 * Find all .gitignore files in a directory tree.
 * Returns files sorted by path depth (root first) to ensure correct
 * processing order for gitignore pattern precedence.
 * Skips node_modules and .git directories for performance.
 */
export async function findGitignoreFiles (dir: string, log?: Logger): Promise<string[]> {
  const gitignoreFiles: string[] = []
  const dirsToWalk: string[] = [dir]
  let dirIndex = 0

  while (dirIndex < dirsToWalk.length) {
    const currentDir = dirsToWalk[dirIndex++]
    try {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        // Skip .git and node_modules for performance
        if (entry.name === '.git' || entry.name === 'node_modules') continue

        if (entry.name === '.gitignore') {
          gitignoreFiles.push(join(currentDir, entry.name))
          continue
        }

        if (entry.isDirectory()) {
          dirsToWalk.push(join(currentDir, entry.name))
        }
      }
    } catch (err) {
      log?.warn({ err, path: currentDir }, 'Failed to read directory while scanning for .gitignore files')
    }
  }

  // Sort by path depth (root .gitignore first) for correct precedence
  return gitignoreFiles.sort((a, b) => {
    const depthA = a.split(sep).length
    const depthB = b.split(sep).length
    return depthA - depthB
  })
}

/**
 * Load all .gitignore patterns from the repository, including nested ones.
 * Patterns from nested .gitignore files are prefixed with their directory path
 * so they apply correctly when matching against repo-relative paths.
 */
export async function loadGitignore (repoPath: string, log?: Logger): Promise<Ignore> {
  const ig = ignore()
  // Always ignore .git directory
  ig.add('.git')

  // Find all .gitignore files in the repo
  const gitignoreFiles = await findGitignoreFiles(repoPath, log)

  for (const gitignorePath of gitignoreFiles) {
    let content: string
    try {
      content = await readFile(gitignorePath, 'utf-8')
    } catch (err) {
      log?.warn({ err, path: gitignorePath }, 'Failed to read .gitignore file')
      continue
    }

    // Get relative path and normalize to forward slashes for gitignore patterns
    const dirRelative = relative(repoPath, dirname(gitignorePath)).split(sep).join('/')

    // Parse each line and prefix patterns from nested .gitignore files
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue

      if (dirRelative) {
        // For nested .gitignore, prefix pattern with directory path
        // Handle negation patterns (lines starting with !) and rooted patterns (starting with /)
        const isNegation = trimmed.startsWith('!')
        let pattern = isNegation ? trimmed.slice(1) : trimmed

        // Remove leading slash - in nested .gitignore, patterns are relative to that directory
        if (pattern.startsWith('/')) {
          pattern = pattern.slice(1)
        }

        const prefixedPattern = `${dirRelative}/${pattern}`
        ig.add(isNegation ? `!${prefixedPattern}` : prefixedPattern)
      } else {
        // Root .gitignore - add patterns as-is
        ig.add(trimmed)
      }
    }
  }

  return ig
}

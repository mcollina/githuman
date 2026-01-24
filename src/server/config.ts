/**
 * Server configuration
 */
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const MIN_TOKEN_LENGTH = 32

export interface ServerConfig {
  port: number;
  host: string;
  authToken: string | null; // null means no auth (localhost only)
  repositoryPath: string;
  dbPath: string;
}

/**
 * Generate a secure random token (32 chars, 192 bits of entropy)
 */
export function generateToken (): string {
  return randomBytes(24).toString('base64')
}

/**
 * Try to find the git repository root from a given path
 */
function findGitRoot (fromPath: string): string | null {
  try {
    const result = execSync('git rev-parse --show-toplevel', {
      cwd: fromPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return result.trim()
  } catch {
    return null
  }
}

export function createConfig (options: Partial<ServerConfig> = {}): ServerConfig {
  // Priority for repository path:
  // 1. Explicit option
  // 2. Git repo root from cwd
  // 3. Current working directory
  const gitRoot = findGitRoot(process.cwd())
  const repositoryPath = options.repositoryPath ?? gitRoot ?? process.cwd()

  // Priority for db path:
  // 1. Explicit option
  // 2. GITHUMAN_DB_PATH environment variable
  // 3. Default to .githuman/reviews.db in repository root
  const defaultDbPath = `${repositoryPath}/.githuman/reviews.db`
  const dbPath = options.dbPath ?? process.env.GITHUMAN_DB_PATH ?? defaultDbPath

  // Priority for auth token:
  // 1. Explicit option (validated for minimum length)
  // 2. GITHUMAN_TOKEN environment variable (validated for minimum length)
  // 3. null (no auth - safe for localhost)
  const authToken = options.authToken ?? process.env.GITHUMAN_TOKEN ?? null

  if (authToken && authToken.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `Auth token must be at least ${MIN_TOKEN_LENGTH} characters. ` +
      'Generate with: openssl rand -base64 32'
    )
  }

  return {
    port: options.port ?? 3847,
    host: options.host ?? 'localhost',
    authToken,
    repositoryPath,
    dbPath,
  }
}

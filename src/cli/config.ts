/**
 * Shared CLI config loading
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

export interface CliConfigFile {
  host?: string;
  port?: number;
  https?: boolean;
  open?: boolean;
  authToken?: string;
}

export interface LoadedCliConfig {
  repositoryPath: string;
  configPath: string;
  values: CliConfigFile;
}

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRepositoryPath (cwd: string): string {
  const resolvedCwd = resolve(cwd)

  try {
    const result = execSync('git rev-parse --show-toplevel', {
      cwd: resolvedCwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return result.trim()
  } catch {
    return resolvedCwd
  }
}

export function getCliConfigPath (cwd = process.cwd()): string {
  return join(getRepositoryPath(cwd), '.githuman', 'config.json')
}

export function loadCliConfig (cwd = process.cwd()): LoadedCliConfig {
  const repositoryPath = getRepositoryPath(cwd)
  const configPath = join(repositoryPath, '.githuman', 'config.json')

  if (!existsSync(configPath)) {
    return {
      repositoryPath,
      configPath,
      values: {},
    }
  }

  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown

  if (!isPlainObject(parsed)) {
    throw new Error(`Invalid GitHuman config in ${configPath}: expected a JSON object`)
  }

  const values: CliConfigFile = {}

  if (parsed.host !== undefined) {
    if (typeof parsed.host !== 'string' || !parsed.host.trim()) {
      throw new Error(`Invalid GitHuman config in ${configPath}: "host" must be a non-empty string`)
    }
    values.host = parsed.host
  }

  if (parsed.port !== undefined) {
    const portValue = parsed.port
    if (typeof portValue !== 'number' || !Number.isInteger(portValue) || portValue <= 0) {
      throw new Error(`Invalid GitHuman config in ${configPath}: "port" must be a positive integer`)
    }
    values.port = portValue
  }

  if (parsed.https !== undefined) {
    if (typeof parsed.https !== 'boolean') {
      throw new Error(`Invalid GitHuman config in ${configPath}: "https" must be a boolean`)
    }
    values.https = parsed.https
  }

  if (parsed.open !== undefined) {
    if (typeof parsed.open !== 'boolean') {
      throw new Error(`Invalid GitHuman config in ${configPath}: "open" must be a boolean`)
    }
    values.open = parsed.open
  }

  if (parsed.authToken !== undefined) {
    if (typeof parsed.authToken !== 'string' || !parsed.authToken.trim()) {
      throw new Error(`Invalid GitHuman config in ${configPath}: "authToken" must be a non-empty string`)
    }
    values.authToken = parsed.authToken
  }

  return {
    repositoryPath,
    configPath,
    values,
  }
}

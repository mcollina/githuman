import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Get project root from current file location
const PROJECT_ROOT = join(import.meta.dirname, '..', '..')

// Export the test repo path for use by tests
export const TEST_REPO_PATH = join(tmpdir(), 'githuman-e2e-test-repo')

export default async function globalSetup () {
  const distPath = join(PROJECT_ROOT, 'dist/web')

  // Build frontend if not already built
  if (!existsSync(distPath)) {
    console.log('[globalSetup] Building frontend for E2E tests...')
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' })
  }

  // Create a temp git repo for E2E tests
  console.log(`Creating test git repo at: ${TEST_REPO_PATH}`)

  // Clean up any existing test repo, but preserve .githuman directory
  // Playwright may start webServer before globalSetup completes, so the server
  // may have already created the database. We preserve it to avoid "readonly database" errors.
  if (existsSync(TEST_REPO_PATH)) {
    const entries = readdirSync(TEST_REPO_PATH)
    for (const entry of entries) {
      if (entry !== '.githuman') {
        rmSync(join(TEST_REPO_PATH, entry), { recursive: true, force: true })
      }
    }
  }

  // Create the directory
  mkdirSync(TEST_REPO_PATH, { recursive: true })

  // Initialize git repo
  execSync('git init', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  // Create .gitignore to exclude .githuman directory (database files)
  writeFileSync(join(TEST_REPO_PATH, '.gitignore'), '.githuman/\n')

  // Create some initial files and commits
  writeFileSync(join(TEST_REPO_PATH, 'README.md'), '# Test Repository\n\nThis is a test repository for E2E tests.')
  execSync('git add .gitignore README.md', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  // Create some source files with multiple commits for testing
  writeFileSync(join(TEST_REPO_PATH, 'index.ts'), '// Main entry point\nexport const version = \'1.0.0\';\n')
  execSync('git add index.ts', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git commit -m "Add index.ts with version"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  writeFileSync(join(TEST_REPO_PATH, 'utils.ts'), '// Utility functions\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n')
  execSync('git add utils.ts', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git commit -m "Add utility functions"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  writeFileSync(join(TEST_REPO_PATH, 'config.ts'), '// Configuration\nexport const config = {\n  debug: false,\n  apiUrl: \'https://api.example.com\',\n};\n')
  execSync('git add config.ts', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git commit -m "Add configuration module"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  // Create a markdown file with code blocks for syntax highlighting tests
  mkdirSync(join(TEST_REPO_PATH, 'docs'), { recursive: true })
  const markdownWithCode = `# Code Examples

## TypeScript

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## JavaScript

\`\`\`javascript
const sum = (a, b) => a + b;
console.log(sum(1, 2));
\`\`\`

## Inline code

Use \`npm install\` to install dependencies.
`
  writeFileSync(join(TEST_REPO_PATH, 'docs/examples.md'), markdownWithCode)
  execSync('git add docs/examples.md', { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  execSync('git commit -m "Add code examples documentation"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

  console.log('Test git repo created with sample commits')
}

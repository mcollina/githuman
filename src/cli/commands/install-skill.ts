/**
 * Install skill command - install the GitHuman skill into the current project
 */
import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

function printHelp() {
  console.log(`
Usage: githuman install-skill [options]

Install the GitHuman Claude Code skill into the current project.

This copies the skill to .claude/skills/githuman/SKILL.md so Claude Code
can automatically help with code reviews in this project.

Options:
  --global               Install to ~/.claude/skills/ instead of project
  -h, --help             Show this help message
`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function installSkillCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      global: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // Find the SKILL.md file relative to this module
  // In development: src/cli/commands -> skills/githuman/SKILL.md
  // In production (npm): dist/cli/commands -> skills/githuman/SKILL.md
  const projectRoot = join(import.meta.dirname, '..', '..', '..');
  const skillSourcePath = join(projectRoot, 'skills', 'githuman', 'SKILL.md');

  if (!(await fileExists(skillSourcePath))) {
    console.error('Error: Could not find SKILL.md in package');
    console.error(`Looked at: ${skillSourcePath}`);
    process.exit(1);
  }

  const skillContent = await readFile(skillSourcePath, 'utf-8');

  let targetDir: string;
  let targetPath: string;

  if (values.global) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (!homeDir) {
      console.error('Error: Could not determine home directory');
      process.exit(1);
    }
    targetDir = join(homeDir, '.claude', 'skills', 'githuman');
    targetPath = join(targetDir, 'SKILL.md');
  } else {
    targetDir = join(process.cwd(), '.claude', 'skills', 'githuman');
    targetPath = join(targetDir, 'SKILL.md');
  }

  // Check if already installed
  if (await fileExists(targetPath)) {
    console.log(`Skill already installed at ${targetPath}`);
    console.log('Updating to latest version...');
  }

  // Create directory and write file
  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, skillContent, 'utf-8');

  console.log(`Installed GitHuman skill to ${targetPath}`);
  console.log('');
  console.log('Restart Claude Code to load the skill.');
}

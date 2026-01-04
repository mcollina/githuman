# GitHuman Claude Code Skill

This skill helps Claude Code users review AI-generated code changes using GitHuman.

## Installation

### Using the CLI (Recommended)

Install the skill into your current project:

```bash
npx githuman install-skill
```

Or install globally for all projects:

```bash
npx githuman install-skill --global
```

### Manual Installation

For your personal Claude Code environment:

```bash
mkdir -p ~/.claude/skills/githuman
curl -o ~/.claude/skills/githuman/SKILL.md \
  https://raw.githubusercontent.com/mcollina/githuman/main/skills/githuman/SKILL.md
```

For a specific project:

```bash
mkdir -p .claude/skills/githuman
curl -o .claude/skills/githuman/SKILL.md \
  https://raw.githubusercontent.com/mcollina/githuman/main/skills/githuman/SKILL.md
```

## Publishing to Claude Marketplace

### Prerequisites

1. Claude account with plugin publishing permissions
2. `claude` CLI installed and authenticated

### Steps to Publish

1. **Create a plugin.json** in the repository root:

```json
{
  "name": "githuman",
  "version": "1.0.0",
  "description": "Review AI-generated code changes before committing",
  "author": "Matteo Collina",
  "repository": "https://github.com/mcollina/githuman",
  "skills": ["skills/githuman/SKILL.md"]
}
```

2. **Validate the plugin structure**:

```bash
claude plugins validate .
```

3. **Publish to the marketplace**:

```bash
claude plugins publish .
```

4. **Verify publication**:

```bash
claude plugins search githuman
```

### After Publishing

Users can install with:

```bash
claude plugins install githuman
```

## Updating the Skill

1. Edit `skills/githuman/SKILL.md` with your changes
2. Update version in `plugin.json`
3. Run `claude plugins publish .` to push updates

## Testing Locally

1. Copy `skills/githuman/SKILL.md` to `~/.claude/skills/githuman/SKILL.md`
2. Restart Claude Code
3. Ask Claude: "What skills are available?" to verify it loaded
4. Test by asking: "Help me review my staged changes"

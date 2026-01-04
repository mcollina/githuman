---
name: githuman
description: Review AI-generated code changes before committing using GitHuman. Use when: reviewing staged changes, creating code reviews, checking what the AI agent wrote, preparing to commit, or when user mentions "review", "GitHuman", or "before commit".
allowed-tools: Bash(*), Read, Glob, Grep
---

# GitHuman - Code Review Skill

GitHuman helps you review AI-generated code changes before committing them.

## Installation

```bash
# Run directly with npx (no install needed)
npx githuman serve

# Or install globally
npm install -g githuman
```

## When to Use This Skill

- After an AI agent has made code changes
- Before committing staged changes
- When you want to review what was modified
- When preparing a commit with proper review

## Workflow

### 1. Start the Review Server

```bash
npx githuman serve
```

This opens a web interface at http://localhost:3847 for visual code review.

### 2. CLI Commands

**List reviews:**
```bash
npx githuman list
```

**Create a review from staged changes:**
Stage your changes first with `git add`, then create a review in the web UI.

**Resolve a review (mark as approved and resolve all comments):**
```bash
npx githuman resolve <review-id|last>
```

**Export a review to markdown:**
```bash
npx githuman export <review-id|last> -o review.md
```

**Manage todos:**
```bash
npx githuman todo list              # List pending todos
npx githuman todo add "Task"        # Add a new todo
npx githuman todo done <id>         # Mark as done
```

### 3. Typical Review Flow

1. AI agent makes changes and stages them with `git add`
2. Run `npx githuman serve` to start the review interface
3. Review the diff in the web UI
4. Add comments or suggestions on specific lines
5. Create todos for follow-up work
6. Approve or request changes
7. When satisfied, commit the changes

## Tips

- Use `npx githuman resolve last` to quickly approve the most recent review
- Export reviews with `npx githuman export last` to keep documentation
- Check `npx githuman todo list` for pending tasks before committing
- If you use GitHuman frequently, install globally: `npm install -g githuman`

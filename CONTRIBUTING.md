# Contributing

## Setup

```bash
npm install
npm run dev        # UI dev server with hot reload on http://localhost:5173
npm run build      # Production build → dist/cli.js
```

## Before submitting a PR

```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm test           # Run tests
```

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Examples:

```
feat: add keyboard shortcut for jumping to next comment
fix: prevent browser from opening twice on slow machines
docs: clarify --diff-only flag behaviour
```

The commit message format is enforced by a pre-commit hook.

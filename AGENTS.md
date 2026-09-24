# AGENTS.md

This file provides guidance and standard conventions for AI coding agents operating in this repository.

## Project Overview

- **Stack**: Vite + React + TypeScript + Phaser 3 + Three.js (`body-rush-phaser-game`)
- **Build / Dev**: `npm run dev` to start Vite dev server, `npm run build` (`tsc && vite build`) for production build.

## Agent skills

### Issue tracker

GitLab Issues (uses the `glab` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default 5 canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

---
name: Git Workflow & Version Control
description: Defines the Git branching strategy and commit rules for the project.
trigger: always_on
---

# Git Workflow & Version Control Rules

1. **Branching Strategy (Git Flow Lite)**:
   - `main`: Production-ready, stable code.
   - `dev`: Active development branch. All feature branches merge here first.
   - `feature/<name>`: For developing new features (e.g., `feature/canvas-overlay`).
   - `bugfix/<name>`: For fixing bugs.

2. **Conventional Commits**:
   Commit messages MUST follow the conventional commit format:
   - `feat: [description]` (New feature)
   - `fix: [description]` (Bug fix)
   - `refactor: [description]` (Code restructuring)
   - `docs: [description]` (Documentation updates)
   - `chore: [description]` (Maintenance, dependencies)

3. **Code Review Agent Workflow**:
   - Before merging any `feature/*` branch into `dev`, the code MUST be reviewed by the Code Review Agent.
   - The primary agent will generate a diff/PR summary, and the Code Review Agent will verify it against `.agents/rules/` constraints.

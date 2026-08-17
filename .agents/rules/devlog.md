# Rule: Development Continuity (Devlog)

**Purpose**: Ensure continuity across development sessions by maintaining and reading a centralized development log.

1. **Context Loading**: 
   - When a user starts a new conversation or asks you to begin a new task, you MUST read the `DEVLOG.md` file at the root of the project to understand the current context, recent decisions, and pending tasks.
   
2. **Auto-Logging**: 
   - After completing a significant feature, closing a debugging session, or when the user indicates the session is ending, you should summarize your work.
   - Propose to the user (or automatically if instructed) to prepend a new entry to `DEVLOG.md` using the standard template found in the file.
   - Always place the newest entry at the top, just below the template comments.

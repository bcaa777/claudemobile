---
name: User Workflow Preferences
description: User prefers direct action over excessive planning, gets frustrated by lost context and unnecessary refactors
type: feedback
---

Don't execute plans that delete existing work without checking what exists first.
**Why:** An engine refactor plan deleted the crawler-world game the user spent 6 hours building. The plan didn't account for existing packages.
**How to apply:** Before any refactor that moves/deletes files, always check for ALL existing packages and code. Never `git add -A` without reviewing what's being deleted.

User prefers action over planning — "please continue" means start working, not write another design doc.
**Why:** User got frustrated when asked to confirm plans while wanting progress on the game.
**How to apply:** When user says "continue", pick up the most impactful work and start doing it. Minimize process overhead.

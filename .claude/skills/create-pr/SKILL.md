# /create-pr

Creates a pull request from the current branch to main via `gh`.

## gh CLI location

`gh` is not on PATH. Use the full path:

```
/c/Program Files/GitHub CLI/gh.exe
```

In Bash: `"/c/Program Files/GitHub CLI/gh.exe"`

## Steps — run in this order, no detours

1. Run one `git log` command to get commits on this branch vs `main`:
   ```bash
   git log main..HEAD --oneline
   ```

2. Run one `git diff main...HEAD --stat` to get a summary of changed files.

3. Draft a PR title (under 70 chars) and body from what you see. No extra reads needed.

4. Create the PR:
   ```bash
   "/c/Program Files/GitHub CLI/gh.exe" pr create \
     --base main \
     --title "..." \
     --body "$(cat <<'EOF'
   ## Summary
   - ...

   ## Test plan
   - ...

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

5. Output the PR URL.

## Rules

- Do NOT search for `gh`, check PATH, or use PowerShell to find the binary. The path above is correct.
- Do NOT check whether a PR already exists first — just create it. If one exists, `gh` will error and tell you.
- Do NOT run `git status`, `git branch`, or any other git commands beyond steps 1–2.
- Target branch is always `main` unless the user specifies otherwise.

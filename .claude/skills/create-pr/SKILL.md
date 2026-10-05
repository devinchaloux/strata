# /create-pr

Opens a pull request from the current branch into `main`. In the maintainer's
sessions, run it when the work is done and nothing more is coming; the
maintainer merges, and `main` deploys publicly.

## Which tool

- **On Devin's Windows machine:** `gh` is not on PATH. Use its full path,
  `"/c/Program Files/GitHub CLI/gh.exe"`. Don't search for it.
- **In a cloud session:** there is no `gh`. Use the GitHub tools the session
  provides (`create_pull_request`), with the same title and body as below.

## Steps — run in this order, no detours

1. Get the commits on this branch that `main` doesn't have:
   ```bash
   git log origin/main..HEAD --oneline
   ```

2. Get a summary of the changed files:
   ```bash
   git diff origin/main...HEAD --stat
   ```

3. Draft a title (under 70 characters) and a body from what you see. No extra
   reads needed.

4. Create the pull request, on Windows:
   ```bash
   "/c/Program Files/GitHub CLI/gh.exe" pr create \
     --base main \
     --title "..." \
     --body "$(cat <<'BODY'
   ## Summary
   - ...

   ## Test plan
   - ...

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   BODY
   )"
   ```
   In a cloud session, pass the same title and body to the GitHub tool, with
   `base` set to `main` and `head` set to the current branch.

5. Output the pull request's URL.

## Rules

- Don't check whether a pull request already exists first; just create it. If
  one exists, the tool says so.
- Don't run any git commands beyond steps 1–2.
- The base is always `main` unless Devin says otherwise.

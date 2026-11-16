# Project instructions

## Text cleanup
Whenever you give the user prose (website copy, emails, docs, chat answers), apply the
`clean-user-facing-text` skill in `.claude/skills/clean-user-facing-text/`
(from github.com/guillaumemeyer/watermarks-remover, MIT):
- Files: run `scripts/clean_text.py FILE -o FILE --stats --no-normalize-spaces`
  before and after any rewrite, and score with `scripts/inspect_text.py --stylometry --json`.
- Chat replies: follow the rewrite rules directly (no stock AI words, varied sentence
  length, straight quotes, no em dashes, no filler sign-offs).
Never change code, commands, paths, URLs, numbers, citations or quotes.

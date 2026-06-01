# Safety Rules

- Never commit secrets, API keys, tokens, or passwords to source control.
- Never disable linters or type checkers to make code compile.
- Never skip or delete tests to make a suite pass.
- Never force-push to main/master branch.
- Never use `--no-verify` to skip pre-commit hooks.
- Never pipe curl/wget output to sh/bash.
- Always use parameterized queries for database operations.
- Always validate and sanitize user input at system boundaries.

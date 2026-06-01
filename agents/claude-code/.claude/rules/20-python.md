# Python Rules

globs: *.py

- Use type hints on all function signatures (Python 3.12+ syntax).
- Prefer dataclasses or Pydantic models over plain dicts for structured data.
- Use f-strings over format() or % formatting.
- Use pytest for testing. Prefer fixtures over setUp/tearDown.
- Use pathlib.Path over os.path for file operations.
- Keep imports sorted: stdlib, third-party, local (isort convention).

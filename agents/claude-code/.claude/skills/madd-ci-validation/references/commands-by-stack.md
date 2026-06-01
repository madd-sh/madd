# CI Commands by Stack — Extended Reference

## Stack Detection

Before running CI, detect the project stack:

```bash
# Check for Node.js
test -f package.json && echo "nodejs"

# Check for Python
test -f pyproject.toml && echo "python" || (test -f setup.py && echo "python") || (test -f requirements.txt && echo "python")

# Check for Go
test -f go.mod && echo "go"

# Check for Rust
test -f Cargo.toml && echo "rust"
```

## Node.js / TypeScript — Full CI Pipeline

### Prerequisites Check

```bash
# Verify node_modules exist
test -d node_modules || npm ci

# Verify TypeScript config
test -f tsconfig.json && echo "typescript" || echo "javascript"
```

### Build

```bash
# Check if build script exists
npm run build 2>&1
# Exit code 0 = success, non-zero = failure
```

### Type Check

```bash
# TypeScript only — separate from build for clearer error messages
npx tsc --noEmit 2>&1
```

### Lint

```bash
# ESLint (check if configured)
test -f .eslintrc* -o -f eslint.config.* && npx eslint src/ --max-warnings 0 2>&1

# Biome (alternative)
test -f biome.json && npx biome check src/ 2>&1
```

### Format

```bash
# Prettier
test -f .prettierrc* -o "$(jq -r '.prettier // empty' package.json 2>/dev/null)" && \
  npx prettier --check "src/**/*.{ts,tsx,js,jsx}" 2>&1
```

### Tests

```bash
# Run tests with coverage
npm test -- --coverage 2>&1

# Extract coverage percentage from output
npm test -- --coverage 2>&1 | grep -E "All files|Stmts"
```

### Auto-Fix

```bash
# Lint fix
npx eslint src/ --fix

# Format fix
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"
```

## Python — Full CI Pipeline

### Prerequisites Check

```bash
# Check virtual environment
test -d .venv || python -m venv .venv
source .venv/bin/activate 2>/dev/null || . .venv/bin/activate

# Install dependencies
pip install -e ".[dev]" 2>/dev/null || pip install -r requirements-dev.txt 2>/dev/null || pip install -r requirements.txt
```

### Build / Compile Check

```bash
# Compile all Python files
python -m py_compile $(find src -name "*.py") 2>&1

# Or use compileall for directories
python -m compileall src/ -q 2>&1
```

### Type Check

```bash
# mypy (if configured)
test -f mypy.ini -o "$(grep -l '\[tool.mypy\]' pyproject.toml 2>/dev/null)" && \
  mypy src/ 2>&1

# pyright (alternative)
test -f pyrightconfig.json && npx pyright src/ 2>&1
```

### Lint

```bash
# Ruff (fast, recommended)
ruff check src/ 2>&1

# Flake8 (legacy)
flake8 src/ 2>&1
```

### Format

```bash
# Black check
black --check src/ 2>&1

# Ruff format check
ruff format --check src/ 2>&1
```

### Tests

```bash
# Run with coverage
pytest --cov=src --cov-report=term-missing -x 2>&1

# Extract coverage
pytest --cov=src --cov-report=term-missing 2>&1 | grep "TOTAL"
```

### Auto-Fix

```bash
# Lint fix
ruff check src/ --fix

# Format fix
black src/
# or
ruff format src/
```

## Go — Full CI Pipeline

### Prerequisites Check

```bash
# Verify go.mod exists and download dependencies
test -f go.mod && go mod download
```

### Build

```bash
go build ./... 2>&1
```

### Vet (Static Analysis)

```bash
go vet ./... 2>&1
```

### Lint

```bash
# golangci-lint (comprehensive)
golangci-lint run 2>&1

# If not installed, use go vet as minimum
command -v golangci-lint >/dev/null 2>&1 || go vet ./... 2>&1
```

### Format

```bash
# Check formatting (gofmt returns non-empty for unformatted files)
UNFORMATTED=$(gofmt -l .)
if [ -n "$UNFORMATTED" ]; then
  echo "Unformatted files:"
  echo "$UNFORMATTED"
  echo "FORMAT_FAILED"
fi
```

### Tests

```bash
# Run with coverage
go test ./... -cover 2>&1

# With race detection
go test ./... -race -cover 2>&1

# Generate coverage profile
go test ./... -coverprofile=coverage.out 2>&1
go tool cover -func=coverage.out | grep total
```

### Auto-Fix

```bash
# Format fix
gofmt -w .

# Import organization
goimports -w .
```

## Interpreting CI Output

### Pass/Fail Determination

```bash
# Generic: check exit code of last command
if [ $? -eq 0 ]; then
  echo "PASS"
else
  echo "FAIL"
fi
```

### Coverage Extraction Patterns

```bash
# Jest/Vitest: look for "All files" line
# Example: "All files | 85.71 | 80 | 100 | 85.71"

# Pytest: look for "TOTAL" line
# Example: "TOTAL    450    67    85%"

# Go: look for "total:" line
# Example: "total:    (statements)    82.3%"
```

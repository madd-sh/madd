# JavaScript / TypeScript Rules

globs: *.js, *.jsx, *.ts, *.tsx

- Use `const` by default. Only use `let` when reassignment is necessary.
- Prefer named exports over default exports.
- Use async/await over .then() chains.
- Enable TypeScript strict mode (`"strict": true` in tsconfig).
- Use template literals over string concatenation.
- Prefer early returns to reduce nesting.
- Handle errors with try/catch at service boundaries, not every function.

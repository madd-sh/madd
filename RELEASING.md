# Releasing & security setup

The pipeline is automated, but a few one-time controls require account-level
actions only the maintainer can perform. Do these once, then releases are a tag push.

## One-time setup

### 1. GPG signed commits (already configured locally)

This repo is configured with:

```sh
git config user.signingkey D385289FA809234F
git config commit.gpgsign true
git config tag.gpgsign true
```

To sign across all your repos instead of just this one, repeat with `--global`.

Add the **public** key to GitHub so commits show as `Verified`:

```sh
gpg --armor --export D385289FA809234F   # paste into GitHub > Settings > SSH and GPG keys
```

Note: GitHub only marks a commit `Verified` when the committer email is both a UID
on the key and a verified email on your account. This key has `m@tthieu.fr`; the repo
currently commits as `matthieu.fronton@frog.co` (also a UID). Make sure the email you
commit with is verified on GitHub, or set `git config user.email m@tthieu.fr`.

### 2. npm: trusted publishing (tokenless) + 2FA

The release workflow publishes via **OIDC trusted publishing** — no `NPM_TOKEN`
is stored anywhere. GitHub Actions proves its identity to npm per-run.

1. Create the npm org/scope `@madd-sh` (done) and enable **2FA** on the account.
2. Configure the trusted publisher for the package on npmjs.org:
   package settings > **Trusted Publisher** > GitHub Actions, with
   org/repo `madd-sh/madd` and workflow `release.yml`.
3. Provenance + tokenless require: repo **public** (done), `id-token: write`
   (set in `release.yml`), and **npm >= 11.5.1** on the runner (the workflow runs
   `npm install -g npm@latest` to guarantee this).

Bootstrap note: npm configures a trusted publisher on an **existing** package, so the
package name must exist first. If the npmjs UI won't let you pre-register the publisher
for `@madd-sh/cli`, do one bootstrap publish to create it, then enable trusted
publishing for every release after that:

```sh
npm login                              # one-time, on your machine
npm publish --access public            # bootstrap v1.0.0 (no provenance on this one)
# then configure the trusted publisher and tag v1.0.1+ via CI (provenance from there on)
```

### 3. GitHub branch protection on `main`

Settings > Branches > add rule for `main`:

- Require a pull request before merging; require review from **Code Owners**.
- Require status checks to pass: `test (18)`, `test (20)`, `test (22)`, `CodeQL`.
- **Require signed commits.**
- Require linear history; block force pushes and deletions.

### 4. Repository security features

Settings > Code security:

- Enable Dependabot alerts + security updates (config already in `.github/dependabot.yml`).
- Enable CodeQL / code scanning (workflow provided).
- Enable private vulnerability reporting (used by `SECURITY.md`).
- Verify the CODEOWNERS handle in `.github/CODEOWNERS` matches your GitHub login.

## Cutting a release

```sh
# 1. Bump version (commit is signed automatically)
npm version patch        # or minor / major -> updates package.json, makes a signed tag

# 2. Push the commit and the signed tag
git push && git push --tags
```

The tag push triggers `.github/workflows/release.yml`, which:

1. verifies the tag matches `package.json` version,
2. runs the test suite,
3. publishes to npm with SLSA provenance (sigstore / Rekor).

## Verifying a published release

```sh
npm view @madd-sh/cli
npm audit signatures      # verifies registry signature + provenance attestation
```

Provenance links the published tarball back to this repo, the workflow file, and the
exact commit, recorded in the public Rekor transparency log. Target: SLSA Build Track L2.
A later move to reusable hardened workflows would raise this toward L3.

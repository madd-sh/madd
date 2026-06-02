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

### 2. npm: trusted publishing + 2FA

1. Create the npm org/scope `@madd-sh` and the package (first publish can be manual
   or via the workflow once the token exists).
2. Enable **2FA** on the npm account (auth + writes).
3. Provenance: the release workflow already passes `--provenance` with `id-token: write`.
   For it to work the repo must be **public** and publishing must come from GitHub Actions.
4. Provide the publish credential as a repo secret named `NPM_TOKEN`
   (npm > Access Tokens > Granular, scoped to `@madd-sh/cli`, publish-only).
   - Preferred upgrade: configure npm **trusted publishing (OIDC)** for the package so
     no long-lived token is stored at all. Once enabled, remove `NPM_TOKEN`.

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

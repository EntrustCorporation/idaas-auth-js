# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the IDaaS Auth JS SDK.

## Workflows

### CI (`ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Steps:**
- Setup Bun and Node.js
- Install dependencies
- Generate API types
- Build the package
- Run linting and type checking
- Run unit and E2E tests
- Upload test results as artifacts

### Publish to npm (`publish.yml`)

Manual workflow for publishing the package to npm.

**Trigger:** Manual dispatch via GitHub Actions UI

**Inputs:**
- `release-type`: Choose between `stable` or `beta`
  - `stable`: Publishes to npm with the `latest` tag (default)
  - `beta`: Publishes to npm with the `beta` tag

**Steps:**
- Runs all CI checks (build, lint, tests)
- Publishes to npm with appropriate tag
- Creates a GitHub release (stable only)

## Setup

### Required Secrets

Add the following secret to your GitHub repository:

1. **`NPM_TOKEN`**: npm authentication token
   - Go to npmjs.com → Account Settings → Access Tokens
   - Generate a new "Automation" token
   - Add it to GitHub: Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm token

### Publishing a Release

1. Go to the "Actions" tab in GitHub
2. Select "Publish to npm" workflow
3. Click "Run workflow"
4. Choose the branch (usually `main`)
5. Select release type:
   - `stable` for production releases
   - `beta` for pre-release versions
6. Click "Run workflow"

### Version Management

Before publishing:
1. Update the version in `package.json`:
   - For stable: `npm version patch|minor|major`
   - For beta: `npm version prerelease --preid=beta`
2. Commit and push the version change
3. Run the publish workflow

## Notes

- The publish workflow only runs manually to prevent accidental publishes
- All tests must pass before publishing
- Beta releases use the `beta` tag on npm: `npm install @entrustcorp/idaas-auth-js@beta`
- Stable releases use the `latest` tag (default): `npm install @entrustcorp/idaas-auth-js`

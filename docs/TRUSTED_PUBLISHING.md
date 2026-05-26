# Trusted ClawHub Publishing

This package is configured for GitHub Actions OIDC trusted publishing.

## ClawHub Package

- Package: `@completetech/openclaw-mautic-plugin`
- Repository: `CompleteTech-LLC-AI-Research/openclaw-mautic-plugin`
- Workflow file: `clawhub-publish.yml`
- Artifact format: ClawPack `npm-pack` `.tgz`

## Workflow

Run the workflow manually from GitHub Actions:

```bash
gh workflow run clawhub-publish.yml --ref main
```

The workflow:

- checks out the repository
- sets up Node.js 24
- runs lint, tests, and package validation
- runs a ClawHub dry run
- publishes through ClawHub using GitHub Actions OIDC

No long-lived ClawHub token is stored in the repository or GitHub Actions secrets.

## Trusted Publisher Config

ClawHub trusted publisher config should report:

```json
{
  "provider": "github-actions",
  "repository": "CompleteTech-LLC-AI-Research/openclaw-mautic-plugin",
  "workflowFilename": "clawhub-publish.yml"
}
```

Check it with:

```bash
clawhub package trusted-publisher get @completetech/openclaw-mautic-plugin --json
```

After publishing, verify the latest release:

```bash
clawhub package inspect @completetech/openclaw-mautic-plugin --json
```

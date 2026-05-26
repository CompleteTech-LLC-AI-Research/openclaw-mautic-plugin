# Trusted ClawHub Publishing

This package is configured for GitHub Actions OIDC trusted publishing.

## ClawHub Package

- Package: `@completetech/openclaw-mautic-plugin`
- Repository: `CompleteTech-LLC-AI-Research/openclaw-mautic-plugin`
- Workflow file: `clawhub-publish.yml`
- Artifact format: ClawPack `npm-pack` `.tgz`
- Workflow artifact: `./clawpack/completetech-openclaw-mautic-plugin-0.1.9.tgz`

## Workflow

Run the workflow manually from GitHub Actions:

```bash
gh workflow run clawhub-publish.yml --ref main
```

The caller workflow:

- checks out the repository
- sets up Node.js 24
- runs lint, tests, and package validation
- runs a ClawHub dry run
- delegates the final publish job to ClawHub's official reusable workflow
- publishes the committed ClawPack `.tgz` through ClawHub using GitHub Actions OIDC

No long-lived ClawHub token is stored in the repository or GitHub Actions secrets.

The committed ClawPack artifact is intentional. ClawHub currently requires the
official reusable workflow for OIDC trusted publishing, and that workflow accepts
a source path but does not yet expose a caller-provided package-build step. A
repository-folder publish would preserve OIDC but can regress this existing
`bundle-plugin` package away from the `npm-pack` artifact path. Publishing the
checked-in `.tgz` keeps both constraints true: official OIDC workflow and
ClawPack `npm-pack` artifact.

For the next release, bump the version first, regenerate the artifact, and update
the workflow `source` path:

```bash
rm -rf clawpack
mkdir -p clawpack
npm exec --yes clawhub -- package pack . --pack-destination clawpack --json
```

Current limitation: ClawHub's official reusable workflow does not expose a
`clawscan_note` input. The local `npm run clawhub:publish` wrapper still includes
the scan note for manual reviewed publishes, but trusted OIDC publishes through
the official workflow cannot attach that note until ClawHub adds the input.

## Current Verification Status

The trusted workflow publish proved that ClawHub accepts the official
OIDC workflow and records the correct source commit, but ClawHub still reports
`verification.scope` as `artifact-only` and `hasProvenance` as `false` for this
community `bundle-plugin` ClawPack release. The package readiness API separately
passes the source provenance check and reports the official-channel status as the
only blocker.

Treat the current ClawHub-side limitation as: trusted GitHub Actions publishing
is active and source-linked, but ClawHub has not upgraded community ClawPack
bundle releases from `artifact-only` verification to provenance-backed
verification.

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

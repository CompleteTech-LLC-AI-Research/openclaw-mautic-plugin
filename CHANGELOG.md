# Changelog

## 0.1.13 - 2026-05-26

- Polished the ClawHub-facing README with a clearer product overview, quick-start path, capability summary, and streamlined safety sections.
- Kept the same conservative runtime behavior: no broad console access, no workspace access unless explicitly enabled, and HTTPS enforcement for routable authenticated API calls.

## 0.1.12 - 2026-05-26

- Enforced transport safety for authenticated Mautic API requests: routable plain-HTTP `baseUrl` values now fail before credentials are sent.

## 0.1.11 - 2026-05-26

- Added explicit Basic auth transport warnings for plain HTTP Mautic API connections.
- Added `mautic_status` transport warning output for non-HTTPS `baseUrl` configurations.

## 0.1.10 - 2026-05-26

- Removed the legacy `MAUTIC_CONSOLE_COMMAND_POLICY` environment fallback; console policy should come from plugin config or the explicit capability toggles.

## 0.1.9 - 2026-05-26

- Excluded local release helper scripts from the published ClawPack artifact to reduce ClawHub static-scan noise.
- Documented that ClawHub still reports community ClawPack bundle releases as `artifact-only` even after official OIDC trusted publishing.

## 0.1.8 - 2026-05-26

- Added GitHub Actions OIDC trusted publishing for ClawHub.
- Added a manual ClawHub publish workflow that validates locally, then calls ClawHub's official reusable publish workflow.
- Updated the workflow to publish the ClawPack `.tgz` artifact through the official ClawHub reusable workflow.
- Documented trusted publisher configuration and verification.

## 0.1.7 - 2026-05-26

- Improved the README production setup section for cleaner ClawHub rendering.
- Replaced inline-code-heavy setup steps with a compact operator checklist table.

## 0.1.6 - 2026-05-26

- Improved the README console bridge section for clearer ClawHub rendering.
- Clarified that only the console-command tool requires the private bridge.

## 0.1.5 - 2026-05-26

- Improved the README security defaults section for clearer ClawHub rendering.
- Replaced code-pill-heavy lists with compact operator-focused tables.

## 0.1.4 - 2026-05-26

- Published through ClawHub's newer ClawPack npm-pack artifact path.
- Kept the existing `bundle-plugin` package family while uploading a `.tgz` ClawPack instead of legacy zip files.
- Updated readiness checks and publish wrapper to preserve the npm-pack artifact format.

## 0.1.3 - 2026-05-26

- Improved the ClawHub README page with clearer compatibility, production setup, and operator safety sections.
- Documented verification against Mautic Community 7.1.1, the latest GitHub release checked on 2026-05-26.

## 0.1.2 - 2026-05-26

- Improved the README security section for clearer ClawHub rendering and operator guidance.

## 0.1.1 - 2026-05-26

- Updated ClawHub release tags for better package discovery.
- Added matching package keywords and GitHub repository topics.
- Cleaned up the production README included in the published package.

## 0.1.0 - 2026-05-26

- Prepared the Mautic Control plugin for ClawHub readiness review.
- Added publishable package metadata, license, security policy, package checks, and runtime unit tests.
- Split pure runtime policy helpers into `lib/runtime.js` for test coverage.
- Changed production defaults so optional maintenance commands and workspace file access are disabled until explicitly enabled.
- Preserved the local Docker stack behavior through explicit stack configuration.
- Documented deployment requirements, console bridge security, threat model, and verification steps.

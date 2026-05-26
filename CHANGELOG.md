# Changelog

## 0.1.4 - 2026-05-26

- Published through ClawHub's newer ClawPack npm-pack artifact path.
- Forced package publishing as a `code-plugin` so ClawHub stores the release as `.tgz` instead of legacy zip.
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

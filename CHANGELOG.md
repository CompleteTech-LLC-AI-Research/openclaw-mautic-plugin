# Changelog

## 0.1.0 - 2026-05-26

- Prepared the Mautic Control plugin for ClawHub readiness review.
- Added publishable package metadata, license, security policy, package checks, and runtime unit tests.
- Split pure runtime policy helpers into `lib/runtime.js` for test coverage.
- Changed production defaults so optional maintenance commands and workspace file access are disabled until explicitly enabled.
- Preserved the local Docker stack behavior through explicit stack configuration.
- Documented deployment requirements, console bridge security, threat model, and verification steps.

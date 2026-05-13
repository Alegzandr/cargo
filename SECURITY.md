# Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Use **[GitHub Security Advisories](../../security/advisories/new)** on this repo to send a private report. Include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept.
- The commit or release version you tested against.
- Any suggested mitigation, if you have one.

We aim to acknowledge new reports within **7 days** and to ship a fix or a documented mitigation within **30 days** for confirmed issues. Coordinated disclosure is appreciated — give us a chance to release a fix before going public.

## Scope

In scope:

- The Cargo application (this repo): web server, cleanup worker, encryption pipeline, Auth.js wiring, tus mount, API routes, abuse/rate-limit logic.
- The bundled Docker / compose configuration insofar as it leaks data or secrets in default configurations.

Out of scope:

- Vulnerabilities in upstream dependencies — please report those to their maintainers (we'll bump the version once a fix is out).
- Operator misconfiguration (weak `CARGO_MASTER_KEY`, exposing the database to the internet, etc.). The defaults documented in `docs/DEPLOY.md` are the supported configuration.
- Findings that require physical access to the server or pre-existing root on the host.

## Operator-facing security model

If you're looking for *how* Cargo handles encryption, headers, abuse, and the privacy model, see [docs/SECURITY.md](docs/SECURITY.md) and [docs/PRIVACY.md](docs/PRIVACY.md).

# S3 dependency maintenance — November 27, 2026

Partial batch in draft #234. Covers only these inspected source requests:

- #83 `d9c1ce091fe469b7300873035aa24ab7cb01ec2f` — Bump minimist from 1.2.5 to 1.2.6 in /typescript/aws/s3
- #116 `7d8728fb3c3bca1eb4f90b96255ff8b427e72672` — Bump protobufjs from 6.11.2 to 6.11.3 in /typescript/aws/s3

## Changes

- minimist 1.2.5 → 1.2.8; protobufjs 6.11.2 → 6.11.6.
- Original lockfile version 2 retained, both package/dependency representations updated. No other dependency versions, direct ranges, infrastructure code, or workflows changed.
- Source floors are superseded, not a claim of complete security remediation.

## Local verification

Node 26.7.0 / npm 11.19.0. Baseline and candidate `npm ci --ignore-scripts --no-audit`, `./node_modules/.bin/tsc --noEmit`, and `npm ls --all` passed.
All lifecycle hooks disabled, including AWS/Docker plugin installers and protobuf postinstall. No infrastructure entry point imported or live infrastructure contacted.

`node --test dependencies.test.cjs`: baseline 2 pass / 3 expected failures (two version floors and actual protobuf setProperty prototype pollution); candidate 5/5 pass, none skipped. Tests use mkdirp-resolved minimist and Pulumi-resolved protobuf, with argument parsing, serialization and pollution regressions. Version checks cover locked copies and corresponding installed copies, not arbitrary extraneous modules.
Prior seven suites: 48/48 pass and all seven typechecks pass.

Two repeated `npm install --package-lock-only --lockfile-version=2 --ignore-scripts --no-audit` generations and a clean directory containing only manifest/lock are byte-identical: SHA256 `ac0558e1372e926c022c93a9c0393b226e1ae33c24a4ed7c0518d1f2337b1fcf`.

## Audit and readiness blockers

Full and production audits both exit 1: baseline 15 entries (3 low, 4 moderate, 6 high, 2 critical), candidate 14 (3 low, 4 moderate, 7 high, 0 critical). No newly introduced advisory IDs; four removed. The high count increases because remaining protobuf advisories now determine its severity after critical advisories are removed.

Remaining entries: @grpc/grpc-js (high), @protobufjs/utf8 (moderate), @pulumi/aws (low), @pulumi/awsx (low), @pulumi/pulumi (high), aws-sdk (moderate), brace-expansion (high), diff (low), js-yaml (high), minimatch (high), protobufjs (high), semver (high), uuid (moderate), xml2js (moderate).

Full advisory JSON and removed IDs are preserved at `/home/lbriggs/.hermes/watchers/jaxxstorm-prs/evidence/pulumi-examples-20261127T150730Z`. Deprecated-package warnings remain. The first local edit attempt encountered duplicate v2 entries and an unnecessary v1 generation; it was discarded, with failed-attempt evidence retained. Final diff preserves v2 and changes only the intended two versions/integrities.

Implementer self-review only, not independent or maintainer approval. No repository example build/test CI; local success is not remote CI. Supported-runtime CI, explicit test dependencies and remaining security modernization remain outstanding. PR stays draft: 31/151 sources covered, 120 explicitly pending in the PR checklist and durable ledger. All 151 original source SHAs remain preserved/open; unrelated human PR #190 untouched. No merge/close/release/deployment.

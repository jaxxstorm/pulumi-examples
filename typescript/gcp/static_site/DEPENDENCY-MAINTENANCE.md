# Dependency maintenance — static_site

## Tested batch (2026-11-22)

Partial consolidation in draft PR #234; no infrastructure code or direct dependency ranges changed.

| Source PR | Inspected head | Coverage |
| --- | --- | --- |
| #87 | `df54929862088f3e44ec65fe7e1fe8bfc5273c86` | Superseded by #219 (minimist 1.2.8) |
| #125 | `4757f1c4e8390ef5f32459786f58c8acf84d6489` | Inspected source patch applied |
| #186 | `9043466c99297e41c289f98b03331160e507aeef` | Inspected source patch applied |
| #219 | `4f1a0380d87a954e49cfcb5a61cc6700a7f365de` | Inspected source patch applied |

The three applied patches update minimist 1.2.5 → 1.2.8, minimatch 3.0.4 → 3.1.2,
protobufjs 6.11.2 → 6.11.3, and protobufjs's nested @types/node 15.12.2 → 18.7.13.
The only additional regeneration change is top-level lockfile key ordering; lockfile v1 retained.

## Local validation

Node v26.7.0 / npm 11.19.0, from this directory:

- `npm ci --ignore-scripts --no-audit`: baseline and candidate pass.
  GCP provider install hook invokes `pulumi plugin install`; lifecycle hooks were inspected
  and deliberately disabled. No Pulumi command, example entry point, or live service was executed.
- `node --test dependencies.test.cjs`: baseline 3 expected package-floor failures + 3 behavioral
  passes; candidate 6 passes, 0 failures/skips. Checks every locked/installed target copy,
  pollution resistance, glob consumer API compatibility, and protobuf round-trip via Pulumi's resolver.
- `./node_modules/.bin/tsc --noEmit`: baseline and candidate pass.
- `npm ls --all --json`: baseline and candidate pass.
- `npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit`:
  repeated generation byte-identical SHA256 `70b1c32f84698b87a1963d922c44d523308c8eb9464cde5e77539fa4ab9c1ec0`.
- `npm audit --json` and `npm audit --omit=dev --json`: both baseline 10 vulnerable entries
  (1 low, 1 moderate, 6 high, 2 critical); both candidate 9
  (1 low, 1 moderate, 6 high, 1 critical). All audit commands exit 1.

These historical source version floors are **not** complete security remediation. Remaining
advisories require follow-up modernization. Offline tests and compilation do not validate deployed
infrastructure. Existing nodes (14 tests) and self_signed_cert (6 tests) regressions and typechecks
were also rerun successfully. No repository build/test workflow validates these examples.

Review: careful one-shot self-review, not independent approval. Keep the PR draft and source PRs open.
Detailed command logs, original patches, audits, review and coverage ledger:
`evidence/pulumi-examples-20261122` in the owner's PR watcher workspace.

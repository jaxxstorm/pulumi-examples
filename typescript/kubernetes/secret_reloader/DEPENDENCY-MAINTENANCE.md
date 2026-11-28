# Secret reloader dependency batch — November 26, 2026

Partial security maintenance only; not full remediation or infrastructure validation.

## Preserved source provenance

| PR | Inspected head | Covered request |
| --- | --- | --- |
| #86 | `71228e8ea87cf300eb2b5b68185e1c27a1dde6d1` | minimist 1.2.6 floor, superseded by #223 |
| #117 | `df3e35c090b91f084c517d126a64b0b3a0e89a01` | protobufjs 6.11.3 floor, exceeded with 6.11.6 |
| #223 | `1e921dcbf9a0ec6f6639e98c499aaa5355637ba1` | minimist 1.2.8 |

Source bodies, diffs and empty discussion/review collections were read. All 151 original source heads remain open and unchanged at this checkpoint. No source PR closed. Full coverage: 29 covered, 122 unimplemented, recorded in PR #234 and the durable ledger.

Only minimist 1.2.5 → 1.2.8 and protobufjs 6.11.2 → 6.11.6 versions change. npm also reorders lock metadata and records an empty kubernetesx `requires` object. Existing nested @types/node is retained. Direct dependency ranges and infrastructure code are unchanged.

## Reproduction and validation

Node 26.7.0 / npm 11.19.0; lifecycle hooks disabled throughout. The Kubernetes provider install hook would install a Pulumi plugin; protobuf postinstall was also disabled. Deprecation and old-lockfile warnings remain.

- Baseline and candidate: `npm ci --ignore-scripts --no-audit`, `./node_modules/.bin/tsc --noEmit`, and `npm ls --all` pass.
- `node --test dependencies.test.cjs`: baseline 2 pass / 3 expected failures (two version floors and actual protobuf `util.setProperty` prototype pollution). Candidate 5 pass / 0 fail, none skipped.
- Behavior tests use mkdirp-resolved minimist and Pulumi-resolved protobuf without importing the infrastructure entry point. They exercise argument parsing, prototype pollution protection, and protobuf serialization. Recursive version checks cover locked copies and their corresponding installed copies, not arbitrary extraneous packages.
- Two repeated `npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit` runs and one clean-directory run containing only the two manifests are byte-identical: SHA256 `cb2dec4fe6619c57b65ce07de9f19fef81cf2d29fa0f48640dab390a22af8dce`.
- Previous six example suites: 43/43 tests pass, all six typechecks pass.

## Remaining security and review limitations

Both `npm audit --json` and `npm audit --omit=dev --json` exit 1. Each falls from 14 vulnerable package entries (2 low, 1 moderate, 7 high, 4 critical) to 13 (2 low, 1 moderate, 8 high, 2 critical). No new advisory IDs. Removed advisory IDs: 1095135, 1097678, 1097723, 1244632. Severity counts can shift because protobufjs still has high findings after critical findings are removed.

Remaining critical: form-data, shell-quote. High: @grpc/grpc-js, @pulumi/pulumi, brace-expansion, js-yaml, minimatch, protobufjs, semver, tmp. Moderate: @protobufjs/utf8. Low: @pulumi/kubernetes, diff. Historical version floors are not evidence of full remediation.

Careful implementer self-review only, not independent approval. Explicit test dependencies, supported-runtime CI, further security modernization, and maintainer review remain outstanding. No repository build/test workflow validates these examples. Local tests are not remote CI. No deployment, Pulumi execution, live infrastructure request, workflow change, merge, closure, or force push.

Full audit findings, source evidence, red/green outputs, prior regression outputs and coverage ledger: `/home/lbriggs/.hermes/watchers/jaxxstorm-prs/evidence/pulumi-examples-20261126T150733Z/`.

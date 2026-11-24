# GKE dependency maintenance — November 24, 2026

This is an incremental historical dependency-request consolidation, **not a clean
security audit or a live GKE validation**. Direct ranges and infrastructure source
are unchanged. Source PRs remain open and the consolidation remains draft.

## Inspected source heads

- #113: `4bc00cf22399b7ae720c5bf05ac9b28e032d2a67` — Bump protobufjs from 6.11.2 to 6.11.3 in /typescript/gcp/gke
- #184: `69af971298a10bb3ebe0b0b460af958ea7da4224` — Bump minimatch from 3.0.4 to 3.1.2 in /typescript/gcp/gke
- #217: `15d4e463e7776094fcc5692003fd6c1caadf443c` — Bump minimist from 1.2.5 to 1.2.8 in /typescript/gcp/gke

The patches update minimist 1.2.5 → 1.2.8, minimatch 3.0.4 → 3.1.2,
and protobufjs 6.11.2 → 6.11.3. Protobuf's redundant nested @types/node 17.0.2
is removed in favor of the existing 14.18.2, which satisfies >=13.7.0; its
production flag is corrected by the inspected source patch. npm normalizes the
order of the lockfileVersion/requires keys. No other package versions change.

## Reproduction and results

Node v26.7.0 / npm 11.19.0, from this directory:

```sh
npm ci --ignore-scripts --no-audit
node --test dependencies.test.cjs
./node_modules/.bin/tsc --noEmit
npm ls --all
npm audit --json
npm audit --omit=dev --json
npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit
```

- Baseline clean install, typecheck, dependency tree pass. New tests first fail
  on precisely the three old version floors; the three behavior tests pass.
- Candidate clean install, six tests, typecheck and dependency tree pass.
- Tests recursively check locked copies and their corresponding installed copies;
  they do not claim to discover arbitrary extraneous node_modules copies.
  Behavioral checks cover minimist parsing/prototype protection, glob-resolved
  minimatch include/exclude/matchOne, and Pulumi-resolved protobuf round trips.
  Test utilities are available transitively in the pinned tree; explicit test
  dependencies and supported-runtime CI remain follow-up work.
- Two repeated lockfile generations and a third in a clean directory without
  node_modules produce identical SHA256 `de6ab2ed2bf2199eb94e076f7d66e443963345fdc1e72c08b8aa15cb7873ca23`.
- Previous batches rechecked: nodes 14/14, self_signed_cert 6/6,
  static_site 6/6, cloudrun 6/6; all four typechecks pass.
- All lifecycle scripts disabled, including GCP, google-native and random
  provider plugin install hooks and protobuf postinstall. Old-lockfile and
  deprecation warnings remain. No infrastructure entry point imported, Pulumi
  execution, cloud calls or integration tests performed.

## Audit limitations

Full and production audits both exit 1: baseline **10** vulnerable package
entries (1 low, 1 moderate, 6 high, 2 critical), candidate **9** (1 low,
1 moderate, 6 high, 1 critical). These are package-entry counts, not unique
advisories. Remaining packages: @grpc/grpc-js, @protobufjs/utf8, @pulumi/pulumi,
brace-expansion, diff, js-yaml, minimatch, protobufjs, semver. The historical
minimatch and protobuf floors remain vulnerable to newer advisories.

Careful one-shot self-review and added-line security scan are not independent
human approval. No repository Actions workflows exist to validate these examples;
local checks must not be represented as passing remote CI.

Durable command logs, audit JSON, source diffs, exact source-head coverage ledger
and publication readbacks:
`/home/lbriggs/.hermes/watchers/jaxxstorm-prs/evidence/pulumi-examples-20261124/`.

# Scaleway dependency maintenance

## Bounded batch — November 28, 2026

Part of draft PR #234; not full security remediation or infrastructure validation.

| Source PR | Inspected source head | Coverage |
| --- | --- | --- |
| #78 | `39c4b91480c0d01bca903ca19ac56ae0c4a3b347` | minimist request superseded by #221 |
| #120 | `faa53b8b68259d67fcef9c61fd0956ed24129002` | protobufjs security patch, advanced to compatible 6.11.6 |
| #221 | `91717f19371e58f173752f0b5ef9801300be1244` | minimist 1.2.8 |

Only minimist 1.2.5 → 1.2.8 and protobufjs 6.11.2 → 6.11.6 change,
plus npm's ordering of lockfile metadata. Lockfile v1, nested @types/node,
direct dependency ranges, infrastructure code and workflows are unchanged.
The protobuf version remains within Pulumi's declared compatible range and
matches the previously validated bounded patch strategy. It is not free of
all current advisories.

## Reproduction and validation

Node 26.7.0 / npm 11.19.0:

- Baseline and candidate `npm ci --ignore-scripts --no-audit` pass. The Scaleway
  provider install hook invokes a Pulumi plugin installer; that hook and all
  other lifecycle scripts (including protobuf postinstall) were disabled.
  Old-lockfile and deprecation warnings remain.
- `node --test dependencies.test.cjs`: baseline **2 pass / 3 expected failures**;
  candidate **5 pass / 0 fail**, none skipped. Two recursive version-floor
  assertions catch the old locked versions. A consumer-resolved protobuf
  `util.setProperty` fixture reproduces actual prototype pollution before the
  update and passes after it. The fixture asserts a clean initial prototype
  and always removes its marker in `finally`.
- Offline tests also exercise mkdirp-resolved minimist argument/prototype
  behavior and Pulumi-resolved protobuf serialization. Resolution starts at
  the actual Pulumi consumer; the example entry point is never imported.
  Version checks cover locked copies and their corresponding installed copies,
  not arbitrary extraneous packages.
- Baseline and candidate `./node_modules/.bin/tsc --noEmit` and `npm ls --all`
  pass. This example's entry point currently contains only a Pulumi import;
  compilation is therefore limited evidence, not a deployment test.
- Two repeated `npm install --package-lock-only --lockfile-version=1
  --ignore-scripts --no-audit` runs and a clean-directory run containing only
  package.json/package-lock.json produced byte-identical SHA256
  `5c03d538fe542931169599e6c8962bbf0b581e5871af2cdad24a34be7b4220aa`.
- Previous eight example suites rechecked: **53/53 tests pass**, all eight
  typechecks pass. These use their existing installations; only this batch
  received fresh baseline/candidate clean installs.

## Remaining audit and readiness blockers

`npm audit --json` and `npm audit --omit=dev --json` both exit 1:

| Scope | Baseline | Candidate |
| --- | --- | --- |
| Full | 10 (1 low, 1 moderate, 6 high, 2 critical) | 9 (1 low, 1 moderate, 7 high, 0 critical) |
| Production | 10 (1 low, 1 moderate, 6 high, 2 critical) | 9 (1 low, 1 moderate, 7 high, 0 critical) |

Counts describe vulnerable package entries, not unique advisories. Four
advisory IDs disappear (1095135, 1097678, 1097723, 1244632); none are added.
The higher high count reflects protobufjs remaining vulnerable at high severity
rather than critical, not a new advisory.

Remaining high entries: @grpc/grpc-js, @pulumi/pulumi, brace-expansion, js-yaml,
minimatch, protobufjs and semver. @protobufjs/utf8 remains moderate; diff low.
Full advisory details, install/test logs and exact source context are retained
in the watcher run's `pulumi-examples-batch` evidence directory.

Added-line static scan, diff checks and implementer self-review are required
before publication; this is not independent approval. Maintainer review and
supported-runtime CI remain outstanding. No example build/test workflow
validates this batch remotely. No infrastructure execution, live service test,
merge, closure, release or deployment was performed. Keep the consolidation draft
and all original source PRs open.

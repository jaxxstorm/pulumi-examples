# Existing IAM user dependency batch — November 25, 2026

Partial consolidation in draft PR #234. This example covers these inspected, still-open source requests; it does not close them:

| Source | Original head | Requested update | Implemented |
| --- | --- | --- | --- |
| #23 | `caab3cb6f589296a334bfe6889ac661db48637d2` | path-parse 1.0.6 → 1.0.7 | 1.0.7 |
| #111 | `572008cef7c41fb00d4eb971b5308c17f586d615` | protobufjs 6.11.2 → 6.11.3 | 6.11.6 |

The newer compatible protobufjs 6.x patch exceeds the historical request. Its existing nested @types/node 15.3.0 is retained rather than adopting the source PR's incidental types upgrade. Only these two locked package versions change; npm also normalizes key ordering. Direct dependency ranges and infrastructure code are unchanged.

## Offline validation

Executed with Node 26.7.0 and npm 11.19.0. From this directory:

```sh
npm ci --ignore-scripts --no-audit
node --test dependencies.test.cjs
./node_modules/.bin/tsc --noEmit
npm ls --all
npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit
npm audit --json
npm audit --omit=dev --json
```

- Baseline and candidate clean installs, typechecks and dependency-tree checks pass. Old-lockfile and deprecated-package warnings remain.
- Baseline regression: 2 pass, 3 fail as expected (both version floors and actual protobuf setProperty prototype pollution). Candidate: **5 pass, 0 fail**, none skipped. Other tests exercise path parsing through resolve's dependency resolver and protobuf serialization through Pulumi's dependency resolver. No Pulumi program is imported.
- Version checks cover every locked copy and its corresponding installed copy, not arbitrary extraneous packages. Tests intentionally use existing transitive dependencies; explicit test dependencies and supported-runtime CI remain follow-up work.
- Two repeated lockfile generations and a clean-directory generation using only package.json/package-lock.json are byte-identical: SHA256 `69ee58f9d16bbffa5ed9e77ae72bf193433086a50979ac11d98855953eec157a`.
- Prior nodes, self_signed_cert, static_site, cloudrun and gke suites pass (14, 6, 6, 6 and 6 tests respectively), as do all five typechecks.
- AWS's install hook would install a Pulumi provider plugin. AWS SDK/protobuf postinstall hooks and all other lifecycle scripts were deliberately disabled using `--ignore-scripts`. No cluster, cloud API, infrastructure preview/update, deployment or release was executed. No workflow changed.
- Careful implementer self-review and added-line security/diff checks, **not independent agent review or human approval**. Delegation is unavailable in this bounded run.

## Remaining audit findings

Both full and production audits exit 1. Each baseline has **14** vulnerable package entries (2 low, 5 moderate, 6 high, 1 critical); each candidate has **13** (2 low, 4 moderate, 7 high, 0 critical). Severity-category shifts do not mean a newly introduced advisory; protobufjs drops from critical to high. These counts are package entries, not distinct advisories or a repository-wide audit.

All remaining affected package entries:

| Severity | Packages |
| --- | --- |
| High | @grpc/grpc-js, @pulumi/pulumi, brace-expansion, js-yaml, minimatch, protobufjs, semver |
| Moderate | @protobufjs/utf8, aws-sdk, uuid, xml2js |
| Low | @pulumi/aws, diff |

In particular protobufjs 6.11.6 still has newer code-generation, prototype-injection and denial-of-service advisories; this batch is **not full security remediation**. Major SDK/provider modernization needs a separate compatibility-tested batch. All advisory details, baseline/candidate logs and audit JSON are retained under `/home/lbriggs/.hermes/watchers/jaxxstorm-prs/evidence/pulumi-examples-20261125T151104Z`.

Keep #234 draft until remaining sources, security findings and independent maintainer review are addressed. Local offline checks are not remote CI or live infrastructure validation.

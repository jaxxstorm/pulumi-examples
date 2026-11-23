# Cloud Run dependency maintenance — 2026-11-23

Partial batch for draft #234. This is not complete security remediation.
Direct dependency ranges and infrastructure source are unchanged.

## Inspected source requests

| PR | Exact inspected source head | Coverage |
| --- | --- | --- |
| #81 | `35ace487c21c414955d844d697125e5371cedf03` | minimist 1.2.6 request superseded by #220 |
| #107 | `a91d374ee4bf99fbdf65984871cb28eeddd2bd07` | protobufjs 6.11.3 and its nested @types/node 18.7.13 |
| #181 | `0a5514e8799df641de3500a815e87df26fdb42ec` | minimatch 3.1.2 |
| #220 | `7f2857b1057f3fc3b1bbeeb68186f9235ef9160d` | minimist 1.2.8 |

Applied the three compatible source lockfile patches, then regenerated with npm.
Other lock changes only reorder keys; direct dependencies remain locked as before.
All source PRs remain open.

## Executed offline validation

Node 26.7.0 / npm 11.19.0:

- Baseline and candidate: `npm ci --ignore-scripts --no-audit` passed. npm emitted old-lockfile and deprecated-dependency warnings. All lifecycle hooks were deliberately disabled: Docker and GCP install scripts download Pulumi provider plugins; protobufjs also declares a postinstall hook. No hook behavior was validated.
- `node --test dependencies.test.cjs`: baseline **3 expected version-floor failures and 3 behavioral passes**; candidate **6 passes**, no failures or skips. Checks cover every locked/installed minimist, minimatch and protobufjs copy; argument parsing/prototype isolation; the legacy glob consumer's include/exclude/matchOne API; and protobuf round-trip serialization through Pulumi's dependency resolver. Passing version floors does not prove absence of newer advisories.
- Baseline and candidate: `./node_modules/.bin/tsc --noEmit` and `npm ls --all` passed. Compilation does not execute infrastructure.
- Repeated `npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit` produced byte-identical SHA256 `967e98c9455a590ec635a071e1a6e9e51719f61adc1995fe0855af92603e5ce5`.
- Prior suites rerun: nodes **14/14**, self_signed_cert **6/6**, static_site **6/6**; all three typechecks passed.

## Audits and limitations

Both `npm audit --json` and `npm audit --omit=dev --json` exited 1:

| Tree | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline full and production, each | 1 | 1 | 7 | 2 | 11 |
| Candidate full and production, each | 1 | 1 | 7 | 1 | 10 |

These are vulnerable package entries, not unique advisories. Remaining dependencies require separate modernization; historical Dependabot floors are not a clean audit. No Pulumi program, Docker build, deployment, infrastructure entry point, or live service was run. Dependency downloads and registry audits used the network. Maintainer review and CI coverage remain separate requirements.

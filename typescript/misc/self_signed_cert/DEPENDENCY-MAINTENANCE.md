# Dependency consolidation: second isolated batch

This review-only batch updates historical dependency requests for this example.
It does not change infrastructure or direct dependency ranges and is **not a
complete security remediation**. Do not close source PRs based on this batch.

## Source provenance

Parent consolidation commit: `ece1c4edb348a4f6432ea2f404c12832a7212593`.

| Source PR | Exact inspected head | Requirement covered |
| --- | --- | --- |
| #63 | `eb227feb6edb53ad15754434700023916ea0a55f` | minimist >=1.2.6, superseded by #218 |
| #123 | `aba79a1b113b69f30576624a5f7800fda1c1ec22` | protobufjs 6.11.3 and deduplicated @types/node |
| #218 | `cf8085f096c0a8baa72d9a394e4cbdd3b04cbacf` | minimist 1.2.8 |
| #222 | `e519f3e9d5959f4522aaadaab76c7dc19596c256` | minimatch 3.1.2 |

Three inspected source diffs were combined; #218 also covers #63. The protobuf
patch reuses root @types/node 14.17.27 instead of nested 16.11.2, and marks the
root copy as a production dependency. Both satisfy protobuf's >=13.7.0 range.
Regenerating with npm retains lockfile version 1 and normalizes top-level key
order. No other dependency version changes were introduced.

## Safe validation

Recorded with Node.js 26.7.0 and npm 11.19.0. Tests require Node.js 18 or newer.
Run from this directory:

```sh
npm ci --ignore-scripts --no-audit
node --test dependencies.test.cjs
./node_modules/.bin/tsc --noEmit
npm ls --all
npm audit --json
npm audit --omit=dev --json
npm install --package-lock-only --lockfile-version=1 --ignore-scripts --no-audit
```

Lifecycle hooks were inspected before installation. The TLS provider's install
hook invokes `scripts/install-pulumi-plugin.js`; protobufjs also has a postinstall
hook. Scripts are deliberately disabled throughout. No Pulumi program, provider
plugin, infrastructure entry point, live service, or certificate resource was
executed. The protobuf test resolves through Pulumi's package metadata without
loading its runtime or this example's index.ts.

- Baseline: three version assertions fail as expected; three behavioral tests
  pass. Candidate: all six tests pass, none skipped.
- Clean installation, TypeScript compilation (`--noEmit`), and full dependency
  tree validation pass on baseline and candidate.
- Behavioral checks cover parser values/prototype pollution, the glob consumer's
  actual minimatch resolver and legacy matchOne API, and protobuf round-tripping.
- Repeated lockfile generation is byte-identical, SHA256
  `6f557d3e14dedb6db8680abc6f8ee3dd63abbfb053d3828a67317428e86dd9f1`.
- Existing nodes batch: 14 tests and typecheck re-run successfully, unchanged.

## Outstanding work

Across both batches, 13 of 151 source requests are covered; **138 remain
unimplemented**. All 151 source PRs remain open; unrelated human PR #190 is
untouched. The first batch's maintenance note records its historical snapshot.

This example's full and production npm audits each fall from 10 package entries
(1 low / 1 moderate / 6 high / 2 critical) to **9** (1 low / 1 moderate / 6 high /
1 critical). Both candidate audits still exit 1. These counts are package entries,
not unique advisories. Nodes separately still reports 29 entries (2 low / 6
moderate / 12 high / 9 critical) in both audits. Do not sum these as unique
repository vulnerabilities or call historical requested versions secure.

These are offline dependency regressions and compilation, not infrastructure
integration tests. No repository build/test workflow validates these examples.
Independent maintainer review and further modernization remain outstanding;
keep consolidation PR #234 draft.

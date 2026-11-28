# Dependency consolidation: first batch

This is an incomplete, review-only consolidation of the historical Dependabot
backlog. It updates only this example. Do not close source PRs or treat this as a
complete security remediation. No application behavior or infrastructure is
changed.

## Source provenance

Base commit: `400071f` (main at the start of this batch).

| Source PR | Exact inspected head | Requirement covered |
| --- | --- | --- |
| #89 | `a0767f6dc873287af784507ac176d8186c33f155` | minimist >=1.2.6 (superseded by #224) |
| #129 | `413ae1b09276e66ffc2674cec373d24f821d372d` | protobufjs 6.11.3, including its nested @types/node update |
| #147 | `7c74a8673e40d107d2c7161a749f23ef4150e74b` | got 11.8.5 |
| #148 | `5dc67c06c7c19c4e700f44eab4388ec797a6a570` | shell-quote 1.7.3 |
| #165 | `3ad4614af36c6eca7e22ef139da9dd6d675244c2` | jose 2.0.6 |
| #185 | `e4b394adaf87604056aff2d7d1476e965f42bcba` | minimatch 3.1.2 |
| #193 | `564fe01ddc6ccb9932c3245de9b5c1ed01c4cc59` | qs 6.5.3 |
| #216 | `ae8595529087e0a12620e487051d075838316337` | http-cache-semantics 4.1.1 |
| #224 | `931e77173a1a3ab8089153a8b25141f5701254be` | minimist 1.2.8 |

Eight original lockfile patches were combined; #224 covers the older #89 request.
The lock was regenerated with npm while retaining lockfile version 1. npm also
normalized key order and added three empty `requires` objects. Direct dependency
ranges are unchanged.

## Safe local validation

Run from this directory with Node.js 18 or newer for the built-in test runner.
The recorded validation used Node.js 26.7.0 and npm 11.19.0.

```sh
npm ci --ignore-scripts --no-audit
node --test dependencies.test.cjs
./node_modules/.bin/tsc --noEmit
npm ls --all
npm audit --json
npm audit --omit=dev --json
```

Scripts are deliberately disabled: the legacy Kubernetes provider's install hook
runs `pulumi plugin install`. The tests do not import `index.ts`, read kubeconfig,
contact Kubernetes, or execute Pulumi. They check installed and locked versions,
parsers, prototype-pollution resistance, glob API compatibility, protobuf
round-tripping, shell quoting, HTTP cache semantics, and offline client creation.
They are dependency smoke/regression tests, not infrastructure integration tests.

The eight version assertions failed against untouched main; all 14 tests pass
with this batch. Baseline and candidate TypeScript checks and dependency-tree
checks pass. Repeating the lockfile-only install produced identical bytes.

## Outstanding work

The inventory contains 151 source Dependabot PRs. This batch covers the requested
version changes for nine, leaving 142 unimplemented. All sources remain open.
Human PR #190 is unrelated and untouched.

Historical patched versions are **not necessarily safe today**. The recorded full
npm audit fell from 32 vulnerable package entries (2 low, 6 moderate, 14 high,
10 critical) to 29 (2 low, 6 moderate, 12 high, 9 critical). Production-only audit
also reports 29. Both candidate audits exit nonzero. These are npm's package-entry
counts, not unique advisory counts. Further dependency modernization and
validation remain required. There is no repository CI workflow validating this
example; local checks must not be represented as passing remote CI.

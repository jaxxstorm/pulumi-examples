// Offline dependency regressions: never load index.ts or contact a cluster.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const minimums = {
    got: '11.8.5',
    'http-cache-semantics': '4.1.1',
    jose: '2.0.6',
    minimatch: '3.1.2',
    minimist: '1.2.8',
    protobufjs: '6.11.3',
    qs: '6.5.3',
    'shell-quote': '1.7.3',
};

for (const [name, minimum] of Object.entries(minimums)) {
    test(`${name}: lockfile and installed dependency meet ${minimum}`, () => {
        const lock = require('./package-lock.json');
        let found = 0;
        function visit(dependencies, directory) {
            for (const [dependency, entry] of Object.entries(dependencies || {})) {
                const installed = path.join(directory, 'node_modules', dependency);
                if (dependency === name) {
                    found++;
                    assert.ok(semver.gte(entry.version, minimum), `${name}@${entry.version} < ${minimum}`);
                    assert.equal(JSON.parse(fs.readFileSync(path.join(installed, 'package.json'))).version, entry.version);
                }
                visit(entry.dependencies, installed);
            }
        }
        visit(lock.dependencies, __dirname);
        assert.ok(found > 0, `${name} is absent from the lockfile`);
    });
}

test('argument parsing does not pollute object prototypes', () => {
    require('minimist')(['--__proto__.polluted', 'yes', '--constructor.prototype.polluted', 'yes']);
    require('qs').parse('__proto__[polluted]=yes&constructor[prototype][polluted]=yes');
    assert.equal({}.polluted, undefined);
    assert.equal(require('minimist')(['--name', 'nodes']).name, 'nodes');
    assert.deepEqual(require('qs').parse('node[name]=worker'), { node: { name: 'worker' } });
});

test('glob matching retains the API used by legacy consumers', () => {
    const minimatch = require('minimatch');
    assert.equal(minimatch('nodes/worker.json', 'nodes/*.json'), true);
    assert.equal(minimatch('nodes/worker.txt', 'nodes/*.json'), false);
    assert.equal(typeof new minimatch.Minimatch('nodes/*.json').matchOne, 'function');
});

test('protobuf messages round trip', () => {
    const protobuf = require('protobufjs');
    const Message = protobuf.parse('syntax = "proto3"; message Node { string name = 1; }').root.lookupType('Node');
    assert.equal(Message.decode(Message.encode({ name: 'worker' }).finish()).name, 'worker');
});

test('shell arguments round trip without invoking a shell', () => {
    const quote = require('shell-quote');
    const args = ['node name', '$(not-executed)', 'a;b', 'plain'];
    assert.deepEqual(quote.parse(quote.quote(args)), args);
});

test('HTTP cache policy handles cacheable responses offline', () => {
    const Policy = require('http-cache-semantics');
    const policy = new Policy({ url: 'https://example.invalid/nodes', method: 'GET', headers: {} },
        { status: 200, headers: { 'cache-control': 'public, max-age=3600' } });
    assert.equal(policy.storable(), true);
    assert.ok(policy.timeToLive() > 0);
    assert.equal(typeof require('got').extend({ retry: 0 }), 'function');
});

test('Kubernetes client constructs offline without reading kubeconfig', () => {
    const k = require('@kubernetes/client-node');
    const config = new k.KubeConfig();
    config.loadFromOptions({ clusters: [{ name: 'test', server: 'https://example.invalid' }],
        users: [{ name: 'test' }], contexts: [{ name: 'test', cluster: 'test', user: 'test' }],
        currentContext: 'test' });
    assert.equal(typeof config.makeApiClient(k.CoreV1Api).listNode, 'function');
});

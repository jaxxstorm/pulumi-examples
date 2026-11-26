// Offline dependency checks: never import index.ts or contact a cluster.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const semver = require('semver');

for (const [name, minimum] of Object.entries({ minimist: '1.2.8', protobufjs: '6.11.6' })) {
    test(`${name}: locked copies and corresponding installed copies meet ${minimum}`, () => {
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
        visit(require('./package-lock.json').dependencies, __dirname);
        assert.ok(found > 0);
    });
}

test('mkdirp-resolved minimist preserves arguments and rejects prototype injection', () => {
    const parse = createRequire(require.resolve('mkdirp'))('minimist');
    assert.deepEqual(parse(['--name', 'offline', '-n', '3', 'file']), { _: ['file'], name: 'offline', n: 3 });
    const key = 'offlineMinimistRegression';
    assert.equal(Object.hasOwn(Object.prototype, key), false);
    try {
        parse([`--__proto__.${key}`, 'polluted', `--constructor.prototype.${key}`, 'polluted']);
        assert.equal(Object.hasOwn(Object.prototype, key), false);
    } finally {
        delete Object.prototype[key];
    }
});

const protobuf = createRequire(require.resolve('@pulumi/pulumi/package.json'))('protobufjs');
test('Pulumi-resolved protobuf setProperty rejects prototype pollution', () => {
    const key = 'offlineProtobufRegression';
    assert.equal(Object.hasOwn(Object.prototype, key), false);
    try {
        protobuf.util.setProperty({}, `__proto__.${key}`, 'polluted');
        assert.equal(Object.hasOwn(Object.prototype, key), false);
    } finally {
        delete Object.prototype[key];
    }
});

test('Pulumi-resolved protobuf serialization round trips', () => {
    const Message = protobuf.parse('syntax = "proto3"; message Item { string name = 1; uint32 id = 2; }').root.lookupType('Item');
    const value = { name: 'offline', id: 42 };
    assert.equal(Message.verify(value), null);
    assert.deepEqual(Message.toObject(Message.decode(Message.encode(value).finish())), value);
});

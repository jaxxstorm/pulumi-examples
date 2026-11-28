// Offline checks only: never import index.ts or execute a Pulumi program.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const semver = require('semver');

for (const [name, minimum] of Object.entries({ 'path-parse': '1.0.7', protobufjs: '6.11.6' })) {
    test(`${name}: every locked copy and corresponding installed copy meets ${minimum}`, () => {
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
        assert.ok(found > 0, `${name} absent from lockfile`);
    });
}

test('resolve consumer preserves POSIX and Windows path parsing', () => {
    const fromResolve = createRequire(require.resolve('resolve'));
    const parse = fromResolve('path-parse');
    assert.deepEqual(parse.posix('/home/user/file.txt'), {
        root: '/', dir: '/home/user', base: 'file.txt', ext: '.txt', name: 'file'
    });
    assert.deepEqual(parse.win32('C:\\users\\file.txt'), {
        root: 'C:\\', dir: 'C:\\users', base: 'file.txt', ext: '.txt', name: 'file'
    });
});

const fromPulumi = createRequire(require.resolve('@pulumi/pulumi/package.json'));
const protobuf = fromPulumi('protobufjs');

test('protobuf setProperty does not pollute Object.prototype', () => {
    const key = 'offlineDependencyRegression';
    assert.equal(Object.hasOwn(Object.prototype, key), false);
    try {
        protobuf.util.setProperty({}, `__proto__.${key}`, 'polluted');
        assert.equal(Object.hasOwn(Object.prototype, key), false);
    } finally {
        delete Object.prototype[key];
    }
});

test('protobuf serialization round trips through the Pulumi dependency resolver', () => {
    const Message = protobuf.parse('syntax = "proto3"; message User { string name = 1; uint32 id = 2; }').root.lookupType('User');
    const value = { name: 'offline-user', id: 42 };
    assert.equal(Message.verify(value), null);
    assert.deepEqual(Message.toObject(Message.decode(Message.encode(value).finish())), value);
});

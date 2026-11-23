// Offline dependency checks only: never import index.ts or run a Pulumi program.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

for (const [name, minimum] of Object.entries({ minimist: '1.2.8', minimatch: '3.1.2', protobufjs: '6.11.3' })) {
    test(`${name}: every locked and installed copy meets ${minimum}`, () => {
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

test('argument parsing preserves values without prototype pollution', () => {
    const parse = require('minimist');
    parse(['--__proto__.polluted', 'yes', '--constructor.prototype.polluted', 'yes']);
    assert.equal({}.polluted, undefined);
    assert.deepEqual(parse(['--name', 'cloudrun', '--port', '8080']), { _: [], name: 'cloudrun', port: 8080 });
});

test('legacy glob consumer retains include, exclude, and matchOne behavior', () => {
    const { createRequire } = require('node:module');
    const fromGlob = createRequire(require.resolve('glob'));
    const minimatch = fromGlob('minimatch');
    assert.equal(minimatch('wwwroot/index.html', 'wwwroot/*.html'), true);
    assert.equal(minimatch('wwwroot/style.css', 'wwwroot/*.html'), false);
    assert.equal(minimatch('wwwroot/style.css', '!wwwroot/*.html'), true);
    const pattern = new minimatch.Minimatch('wwwroot/*.html');
    assert.equal(pattern.matchOne(['wwwroot', 'index.html'], pattern.set[0], false), true);
});

test('protobuf serialization round trips through the Pulumi dependency resolver', () => {
    const { createRequire } = require('node:module');
    const fromPulumi = createRequire(require.resolve('@pulumi/pulumi/package.json'));
    const protobuf = fromPulumi('protobufjs');
    const Message = protobuf.parse('syntax = "proto3"; message Service { string name = 1; uint32 port = 2; }').root.lookupType('Service');
    const value = { name: 'offline-cloudrun', port: 8080 };
    assert.equal(Message.verify(value), null);
    assert.deepEqual(Message.toObject(Message.decode(Message.encode(value).finish())), value);
});

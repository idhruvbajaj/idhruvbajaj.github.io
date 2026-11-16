const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('private Blob content retries concurrent writes and persists sessions between instances', async () => {
    const records = new Map();
    let version = 0;
    
    const { BlobError, BlobPreconditionFailedError } = require('@vercel/blob');
    const sdk = {
        BlobPreconditionFailedError,
        async get(key, options) {
            assert.equal(options.access, 'private');
            assert.equal(options.useCache, false);
            const record = records.get(key);
            return record ? { stream: new Response(record.body).body, blob: { etag: record.etag } } : null;
        },
        async put(key, body, options) {
            assert.equal(options.access, 'private');
            const record = records.get(key);
            if (record && !options.allowOverwrite) throw new BlobError('Blob already exists');
            if (options.ifMatch && options.ifMatch !== record?.etag) throw new BlobPreconditionFailedError();
            records.set(key, { body, etag: String(++version) });
        },
        async del(key) { records.delete(key); }
    };
    const moduleObject = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../storage.js'), 'utf8'), {
        require: name => name === '@vercel/blob' ? sdk : require(name),
        process: { env: { VERCEL: '1', BLOB_READ_WRITE_TOKEN: 'test-only' } },
        module: moduleObject, __dirname: path.join(__dirname, '..'), Response, structuredClone
    });
    const { createContentStore, PersistentSessionStore } = moduleObject.exports;
    const first = createContentStore({ topics: [] });
    const second = createContentStore({ topics: [] });
    await Promise.all([
        first.update(content => content.topics.push({ id: 'one' })),
        second.update(content => content.topics.push({ id: 'two' }))
    ]);
    assert.equal((await first.get()).topics.length, 2);
    await Promise.all([
        first.update(content => content.topics.push({ id: 'three' })),
        second.update(content => content.topics.push({ id: 'four' }))
    ]);
    assert.equal((await second.get()).topics.length, 4);
    const a = new PersistentSessionStore();
    const b = new PersistentSessionStore();
    const sessionValue = { adminEmail: 'test@example.test', cookie: { expires: new Date(Date.now() + 100000).toISOString() } };
    await new Promise((resolve, reject) => a.set('test-session', sessionValue, error => error ? reject(error) : resolve()));
    const saved = await new Promise((resolve, reject) => b.get('test-session', (error, value) => error ? reject(error) : resolve(value)));
    assert.equal(saved.adminEmail, sessionValue.adminEmail);
    await new Promise((resolve, reject) => b.destroy('test-session', error => error ? reject(error) : resolve()));
    assert.equal(await new Promise((resolve, reject) => a.get('test-session', (error, value) => error ? reject(error) : resolve(value))), null);
    await new Promise((resolve, reject) => a.set('expired-session', { ...sessionValue, cookie: { expires: new Date(0).toISOString() } }, error => error ? reject(error) : resolve()));
    assert.equal(await new Promise((resolve, reject) => b.get('expired-session', (error, value) => error ? reject(error) : resolve(value))), null);
});

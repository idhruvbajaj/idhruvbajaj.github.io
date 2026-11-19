const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { get, put, del, BlobPreconditionFailedError } = require('@vercel/blob');
const session = require('express-session');

const contentPath = 'blog/content.json';
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
if (process.env.VERCEL && !useBlob) throw new Error('Connect a private Vercel Blob store before deploying.');
const localRoot = process.env.BLOG_DATA_DIRECTORY || path.join(__dirname, 'data');
let pendingLocalUpdate = Promise.resolve();

async function read(key) {
    if (useBlob) {
        const result = await get(key, { access: 'private', useCache: false });
        if (!result) return null;
        return { value: await new Response(result.stream).json(), etag: result.blob.etag };
    }
    try {
        return { value: JSON.parse(await fs.readFile(path.join(localRoot, key), 'utf8')) };
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function write(key, value, etag, createOnly = false, ttlDays) {
    if (useBlob) {
        return put(key, JSON.stringify(value), {
            access: 'private', contentType: 'application/json', addRandomSuffix: false,
            allowOverwrite: !createOnly, ...(etag ? { ifMatch: etag } : {}),
            ...(ttlDays ? { ttlDays } : {})
        });
    }
    const file = path.join(localRoot, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await fs.rename(temporary, file);
}

async function remove(key) {
    if (useBlob) return del(key);
    await fs.rm(path.join(localRoot, key), { force: true });
}

function createContentStore(defaultContent) {
    async function updateContent(change) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const record = await read(contentPath);
            const content = record ? record.value : structuredClone(defaultContent);
            const result = change(content);
            try {
                await write(contentPath, content, record?.etag, !record);
                return result;
            } catch (error) {
                // Retry from the latest version instead of discarding another admin's edit.
                if (error instanceof BlobPreconditionFailedError) continue;
                if (useBlob && !record && await read(contentPath)) continue;
                throw error;
            }
        }
        const error = new Error('Content changed while saving. Please try again.');
        error.status = 409;
        throw error;
    }

    return {
        async get() {
            const record = await read(contentPath);
            return record ? record.value : structuredClone(defaultContent);
        },
        update(change) {
            if (useBlob) return updateContent(change);
            // Local development uses one Node process and has no Blob ETags.
            const update = pendingLocalUpdate.then(() => updateContent(change));
            pendingLocalUpdate = update.catch(() => {});
            return update;
        }
    };
}

class PersistentSessionStore extends session.Store {
    key(id) {
        if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid session identifier.');
        return `sessions/${id}.json`;
    }
    get(id, callback) {
        (async () => {
            const record = await read(this.key(id));
            if (!record || record.value.expires <= Date.now()) return null;
            return record.value.session;
        })().then(value => callback(null, value), callback);
    }
    set(id, value, callback = () => {}) {
        const expires = new Date(value.cookie.expires).getTime();
        write(this.key(id), { session: value, expires }, null, false, 1).then(() => callback(), callback);
    }
    destroy(id, callback = () => {}) {
        remove(this.key(id)).then(() => callback(), callback);
    }
    // Sessions have a fixed eight-hour lifetime, so reads do not need storage writes.
    touch(id, value, callback = () => {}) { callback(); }
}

module.exports = { createContentStore, PersistentSessionStore };

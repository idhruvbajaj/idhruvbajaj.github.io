const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let server, base, cookie, directory;
before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-api-test-'));
    process.env.BLOG_DATA_DIRECTORY = directory;
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    process.env.ADMIN_EMAIL = 'Admin@example.test';
    process.env.ADMIN_PASSWORD = 'test-admin-password-12345';
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    server = require('../server').listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (directory) await fs.rm(directory, { recursive: true, force: true });
});
async function request(url, method = 'GET', body, headers = {}) {
    return fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('homepage, authentication, durable edits, validation and logout', async () => {
    assert.equal((await request('/')).status, 200);
    assert.equal((await request('/admin')).status, 200);
    for (const asset of ['/index.html', '/admin.html', '/style.css', '/script.js', '/admin.js']) assert.equal((await request(asset)).status, 200);
    for (const file of ['/server.js', '/storage.js', '/package.json', '/.env', '/data/blog/content.json']) assert.equal((await request(file)).status, 404);
    assert.equal((await request('/api/admin/settings', 'PUT', {})).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: 'wrong' })).status, 401);
    const login = await request('/api/auth/login', 'POST', { email: 'ADMIN@example.test', password: process.env.ADMIN_PASSWORD });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await request('/api/auth/me')).status, 200);
    assert.equal((await request('/api/admin/topics', 'POST', { name: 'Blocked' }, { Origin: 'https://untrusted.example' })).status, 403);
    const publicResponse = await request('/api/content');
    for (const origin of ['https://idhruvbajaj.github.io', 'https://idhruvbajaj.is-a.dev', 'http://idhruvbajaj.is-a.dev']) {
        const response = await request('/api/content', 'GET', undefined, { Origin: origin });
        assert.equal(response.headers.get('access-control-allow-origin'), origin);
        assert.match(response.headers.get('vary'), /Origin/i);
    }
    const untrusted = await request('/api/content', 'GET', undefined, { Origin: 'https://untrusted.example' });
    assert.equal(untrusted.headers.get('access-control-allow-origin'), null);
    assert.equal((await request('/api/auth/me')).headers.get('access-control-allow-origin'), null);
    const original = await publicResponse.json();
    const settings = { ...original.settings, heroTitle: 'A saved title' };
    assert.equal((await request('/api/admin/settings', 'PUT', settings)).status, 200);
    assert.equal((await request('/api/admin/settings', 'PUT', { ...settings, name: '' })).status, 400);
    assert.equal((await (await request('/api/content')).json()).settings.heroTitle, 'A saved title');
    const created = await request('/api/admin/topics', 'POST', { name: 'Persistence test', description: 'Saved content' });
    assert.equal(created.status, 201);
    const { topic } = await created.json();
    assert.equal((await request('/api/admin/topics', 'POST', { name: 'PERSISTENCE TEST' })).status, 409);
    const concurrentTopics = ['Concurrent topic A', 'Concurrent topic B'];
    const concurrentWrites = await Promise.all([
        request('/api/admin/settings', 'PUT', { ...settings, heroTitle: 'Updated alongside topics' }),
        ...concurrentTopics.map(name => request('/api/admin/topics', 'POST', { name }))
    ]);
    assert.deepEqual(concurrentWrites.map(response => response.status), [200, 201, 201]);
    const persisted = require('../storage').createContentStore({});
    const savedContent = await persisted.get();
    assert.equal(savedContent.settings.heroTitle, 'Updated alongside topics');
    assert.ok(savedContent.topics.some(item => item.id === topic.id));
    assert.ok(concurrentTopics.every(name => savedContent.topics.some(item => item.name === name)));
    assert.equal((await request(`/api/admin/topics/${topic.id}`, 'DELETE')).status, 204);
    assert.equal((await request(`/api/admin/topics/${topic.id}`, 'DELETE')).status, 404);
    assert.equal((await request('/api/auth/logout', 'POST')).status, 204);
    assert.equal((await request('/api/auth/me')).status, 401);
    assert.equal((await request('/api/admin/settings', 'PUT', settings)).status, 401);
});

test('missing admin configuration disables sign-in and keeps public content available', async t => {
    const modulePath = require.resolve('../server');
    const originalModule = require.cache[modulePath];
    const originalPassword = process.env.ADMIN_PASSWORD;
    let app;
    try {
        delete process.env.ADMIN_PASSWORD;
        delete require.cache[modulePath];
        app = require('../server');
    } finally {
        process.env.ADMIN_PASSWORD = originalPassword;
        require.cache[modulePath] = originalModule;
    }

    const unconfiguredServer = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => unconfiguredServer.close(resolve)));
    await new Promise(resolve => unconfiguredServer.once('listening', resolve));
    const base = `http://127.0.0.1:${unconfiguredServer.address().port}`;
    assert.equal((await fetch(`${base}/api/content`)).status, 200);
    const auth = await fetch(`${base}/api/auth/me`);
    assert.equal(auth.status, 503);
    assert.equal((await auth.json()).error, 'Admin sign-in is unavailable. Check the server configuration.');
    assert.equal((await fetch(`${base}/api/admin/settings`, { method: 'PUT' })).status, 503);
});

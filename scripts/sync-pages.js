// GitHub Pages serves the repository root; Vercel serves public/ and the Express API.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const file of ['index.html', 'style.css', 'script.js']) {
    fs.copyFileSync(path.join(root, 'public', file), path.join(root, file));
}
fs.cpSync(path.join(root, 'public', 'assets'), path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, '.nojekyll'), '');
fs.writeFileSync(path.join(root, 'admin.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Open blog admin</title>
<meta http-equiv="refresh" content="0; url=https://idhruvbajaj-github-io.vercel.app/admin.html">
<link rel="canonical" href="https://idhruvbajaj-github-io.vercel.app/admin.html"></head>
<body><p><a href="https://idhruvbajaj-github-io.vercel.app/admin.html">Open the admin page</a>.</p></body></html>\n`);

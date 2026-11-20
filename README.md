## Website addresses

The main public site is https://idhruvbajaj.is-a.dev/. The Vercel homepage redirects there. The admin page stays at https://idhruvbajaj-github-io.vercel.app/admin.html, and the public site loads saved content from the Vercel API. Only `/api/content` permits cross-origin reads from the GitHub Pages domain and its custom domain; admin access stays same-origin.

After editing `public/index.html`, `public/style.css`, `public/script.js`, or files in `public/assets/`, run `npm run sync-pages` and commit the generated root copies so GitHub Pages publishes the same frontend. Do not replace the root index with a redirect to Vercel, because that would create a redirect loop. The root `.nojekyll` ensures GitHub Pages serves the static files directly.

# Dhruv's personal blog

Browser HTML, CSS and JavaScript live in `public/`, served by the Vercel CDN in production and Express locally. Express handles the protected admin API. Production content and admin sessions live in a **private Vercel Blob store**, so they survive cold starts and redeployments without writing into Vercel's read-only application directory.

## Configuration

Set these project environment variables for Production:

- `SESSION_SECRET`: a cryptographically random secret of at least 32 characters.
- `ADMIN_EMAIL`: the website administrator's email address.
- `ADMIN_PASSWORD`: a unique password of at least 12 characters.
- `BLOB_READ_WRITE_TOKEN`: supplied automatically when connecting the private Blob store to this Vercel project. Never expose this to browser code.

Redeploy after changing environment variables. The admin page is `/admin`. Passwords are checked against the environment configuration; no plaintext password is saved in content storage. Sessions are private, expire after eight hours, and are removed on logout. Secure cookies work behind Vercel's HTTPS proxy.

Content is saved in `blog/content.json`. Updates use ETag conditional writes and retry conflicts to avoid losing simultaneous edits. New sites start with the original default settings and topics. Admin sessions use separate private objects with automatic expiry.

On Vercel Hobby, Blob has included usage with hard limits; exceeding the allowance pauses storage rather than adding paid overage. Check usage in the Vercel dashboard. The existing GitHub repository is connected to Vercel, so pushes to `main` deploy the repaired code automatically.

## Local development

Run `npm ci`, copy `.env.example` to `.env`, set local credentials, and run `npm start`. Without a Blob connection, local content and sessions are saved under the ignored `data/` directory. Production requires a connected Blob store and never falls back to temporary storage.

Run `npm test` for API authentication, persistence, validation, logout, private-file protection, concurrent Blob updates, and session persistence checks. Tests use temporary local data or a simulated Blob service and do not access production credentials.

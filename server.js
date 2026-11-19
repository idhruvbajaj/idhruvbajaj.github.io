require("dotenv").config();
const path = require("node:path");
const { createHash, timingSafeEqual, randomUUID } = require("node:crypto");
const express = require("express");
const session = require("express-session");
const { createContentStore, PersistentSessionStore } = require("./storage");

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminConfigured = sessionSecret?.length >= 32 && adminEmail && adminPassword?.length >= 12;
const passwordDigest = adminConfigured ? createHash("sha256").update(adminPassword).digest() : null;
if (!adminConfigured) console.warn("Admin sign-in is disabled. Check SESSION_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD.");

const defaultSettings = {
    name: "Dhruv Bajaj",
    kicker: "Dhruv Bajaj",
    heroTitle: "Ideas, projects, and notes in one clean place.",
    heroDescription: "A personal blog for code, college life, routines, and the details I want to remember.",
    aboutTitle: "I like making ideas easier to see, use, and remember.",
    aboutDescription: "I am a student exploring front-end engineering, design, and the habit of writing things down before they disappear."
};

const defaultTopics = [
    ["code", "Code", "Frontend experiments and lessons."],
    ["college", "College", "Projects, classes, and learning."],
    ["life", "Life", "Routines and useful personal systems."]
];

const contentStore = createContentStore({
    settings: defaultSettings,
    topics: defaultTopics.map(([id, name, description]) => ({ id, name, description }))
});
const asyncRoute = handler => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Vercel terminates HTTPS at its proxy. Trust it when setting secure session cookies.
if (process.env.VERCEL) app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api", (request, response, next) => {
    response.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.origin) {
        try {
            if (new URL(request.headers.origin).host !== request.get("host")) return response.status(403).json({ error: "Request origin is not allowed." });
        } catch { return response.status(403).json({ error: "Request origin is not allowed." }); }
    }
    next();
});
const adminSession = adminConfigured ? session({
    name: "dhruv_blog_session", secret: sessionSecret,
    store: new PersistentSessionStore(), resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}) : (request, response) => {
    response.status(503).json({ error: "Admin sign-in is unavailable. Check the server configuration." });
};
app.use(["/api/auth", "/api/admin"], adminSession);

function requireAuth(request, response, next) {
    if (request.session.adminEmail !== adminEmail) return response.status(401).json({ error: "Authentication required." });
    next();
}

// Only public content is readable from the GitHub Pages frontend; admin endpoints stay same-origin.
app.get("/api/content", (request, response, next) => {
    const origin = request.get("Origin");
    response.vary("Origin");
    if (["https://idhruvbajaj.github.io", "https://idhruvbajaj.is-a.dev", "http://idhruvbajaj.is-a.dev"].includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
    }
    next();
}, asyncRoute(async (request, response) => response.json(await contentStore.get())));
app.post("/api/auth/login", (request, response, next) => {
    const email = String(request.body.email || "").trim().toLowerCase();
    const digest = createHash("sha256").update(String(request.body.password || "")).digest();
    if (!timingSafeEqual(digest, passwordDigest) || email !== adminEmail) return response.status(401).json({ error: "Invalid email or password." });
    request.session.regenerate(error => {
        if (error) return next(error);
        request.session.adminEmail = adminEmail;
        request.session.save(error => error ? next(error) : response.json({ email: adminEmail }));
    });
});
app.post("/api/auth/logout", requireAuth, (request, response, next) => {
    request.session.destroy(error => {
        if (error) return next(error);
        response.clearCookie("dhruv_blog_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        response.status(204).end();
    });
});
app.get("/api/auth/me", requireAuth, (request, response) => response.json({ email: adminEmail }));
app.put("/api/admin/settings", requireAuth, asyncRoute(async (request, response) => {
    const settings = {};
    for (const key of Object.keys(defaultSettings)) {
        const value = String(request.body[key] || "").trim();
        if (!value || value.length > 400) throw fail(`Invalid value for ${key}.`);
        settings[key] = value;
    }
    await contentStore.update(content => { content.settings = settings; });
    response.json({ settings });
}));
app.post("/api/admin/topics", requireAuth, asyncRoute(async (request, response) => {
    const name = String(request.body.name || "").trim();
    const description = String(request.body.description || "").trim();
    if (!name || name.length > 30 || description.length > 90) throw fail("Topic name or description is invalid.");
    const topic = { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}`, name, description };
    await contentStore.update(content => {
        if (content.topics.some(item => item.name.toLowerCase() === name.toLowerCase())) throw fail("That topic already exists.", 409);
        content.topics.push(topic);
    });
    response.status(201).json({ topic });
}));
app.delete("/api/admin/topics/:id", requireAuth, asyncRoute(async (request, response) => {
    await contentStore.update(content => {
        const index = content.topics.findIndex(topic => topic.id === request.params.id);
        if (index < 0) throw fail("Topic not found.", 404);
        content.topics.splice(index, 1);
    });
    response.status(204).end();
}));
app.use("/api", (request, response) => response.status(404).json({ error: "Not found." }));
// Vercel serves public/ from its CDN. Express serves the same files locally.
app.use(express.static(path.join(__dirname, "public")));
app.get("/admin", (request, response) => response.redirect("/admin.html"));
app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error("Request failed:", error.name, error.message);
    response.status(status).json({ error: status >= 500 ? "Could not complete the request. Please try again." : error.message });
});
if (require.main === module) app.listen(port, () => console.log(`Blog server running at http://localhost:${port}`));
module.exports = app;

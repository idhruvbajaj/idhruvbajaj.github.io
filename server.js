require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const dataDirectory = path.join(__dirname, "data");

if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set and contain at least 32 characters.");
}

if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error("ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required.");
}

fs.mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(path.join(dataDirectory, "blog.sqlite"));
database.exec(`
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

const existingAdmin = database.prepare("SELECT id FROM admins WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 12);
    database.prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?)").run(adminEmail, passwordHash);
}

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

const settingInsert = database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
Object.entries(defaultSettings).forEach(([key, value]) => settingInsert.run(key, value));
const topicInsert = database.prepare("INSERT OR IGNORE INTO topics (id, name, description) VALUES (?, ?, ?)");
defaultTopics.forEach((topic) => topicInsert.run(...topic));

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    name: "dhruv_blog_session",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 8
    }
}));

function requireAuth(request, response, next) {
    if (!request.session.adminId) {
        return response.status(401).json({ error: "Authentication required." });
    }
    next();
}

function getPublicContent() {
    const settings = Object.fromEntries(
        database.prepare("SELECT key, value FROM settings").all().map((row) => [row.key, row.value])
    );
    const topics = database.prepare("SELECT id, name, description FROM topics ORDER BY created_at ASC").all();
    return { settings, topics };
}

app.get("/api/content", (request, response) => {
    response.json(getPublicContent());
});

app.post("/api/auth/login", (request, response) => {
    const email = String(request.body.email || "").trim().toLowerCase();
    const password = String(request.body.password || "");
    const admin = database.prepare("SELECT id, email, password_hash FROM admins WHERE email = ?").get(email);

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return response.status(401).json({ error: "Invalid email or password." });
    }

    request.session.regenerate((error) => {
        if (error) return response.status(500).json({ error: "Could not start a secure session." });
        request.session.adminId = admin.id;
        request.session.adminEmail = admin.email;
        response.json({ email: admin.email });
    });
});

app.post("/api/auth/logout", requireAuth, (request, response) => {
    request.session.destroy((error) => {
        if (error) return response.status(500).json({ error: "Could not end the session." });
        response.clearCookie("dhruv_blog_session");
        response.status(204).end();
    });
});

app.get("/api/auth/me", requireAuth, (request, response) => {
    response.json({ email: request.session.adminEmail });
});

app.put("/api/admin/settings", requireAuth, (request, response) => {
    const allowedKeys = Object.keys(defaultSettings);
    const update = database.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    try {
        database.exec("BEGIN");
        allowedKeys.forEach((key) => {
            const value = String(request.body[key] || "").trim();
            if (!value || value.length > 400) throw new Error(`Invalid value for ${key}.`);
            update.run(key, value);
        });
        database.exec("COMMIT");
        response.json({ settings: getPublicContent().settings });
    } catch (error) {
        database.exec("ROLLBACK");
        response.status(400).json({ error: error.message });
    }
});

app.post("/api/admin/topics", requireAuth, (request, response) => {
    const name = String(request.body.name || "").trim();
    const description = String(request.body.description || "").trim();
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    if (!name || name.length > 30 || description.length > 90) {
        return response.status(400).json({ error: "Topic name or description is invalid." });
    }

    try {
        database.prepare("INSERT INTO topics (id, name, description) VALUES (?, ?, ?)").run(id, name, description);
        response.status(201).json({ topic: { id, name, description } });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return response.status(409).json({ error: "That topic already exists." });
        response.status(500).json({ error: "Could not create topic." });
    }
});

app.delete("/api/admin/topics/:id", requireAuth, (request, response) => {
    const result = database.prepare("DELETE FROM topics WHERE id = ?").run(request.params.id);
    if (!result.changes) return response.status(404).json({ error: "Topic not found." });
    response.status(204).end();
});

app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Blog server running at http://localhost:${port}`);
});

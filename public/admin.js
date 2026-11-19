const defaultSettings = {
    name: "Dhruv Bajaj",
    kicker: "Dhruv Bajaj",
    heroTitle: "Ideas, projects, and notes in one clean place.",
    heroDescription: "A personal blog for code, college life, routines, and the details I want to remember.",
    aboutTitle: "I like making ideas easier to see, use, and remember.",
    aboutDescription: "I am a student exploring front-end engineering, design, and the habit of writing things down before they disappear."
};

const loginPanel = document.getElementById("adminLogin");
const adminContent = document.getElementById("adminContent");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const logoutStatus = document.getElementById("logoutStatus");
const settingsForm = document.getElementById("siteSettingsForm");
const topicForm = document.getElementById("topicForm");
const topicManager = document.getElementById("topicManager");
const topicCount = document.getElementById("topicCount");
const settingsStatus = document.getElementById("settingsStatus");
const topicStatus = document.getElementById("topicStatus");

async function request(url, options = {}) {
    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
    } catch {
        throw new Error("Couldn’t connect. Check your connection and try again.");
    }

    if (response.status === 204) return null;
    const data = response.headers.get("content-type")?.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
    if (!response.ok || !data) {
        throw new Error(data?.error || "The admin service is temporarily unavailable. Try again in a moment.");
    }
    return data;
}

function showAdmin() {
    loginPanel.hidden = true;
    adminContent.hidden = false;
    logoutButton.hidden = false;
}

function showLogin() {
    loginPanel.hidden = false;
    adminContent.hidden = true;
    logoutButton.hidden = true;
}

function fillSettingsForm(settings) {
    Object.entries({ ...defaultSettings, ...settings }).forEach(([key, value]) => {
        const input = document.getElementById(`admin${key.charAt(0).toUpperCase()}${key.slice(1)}`);
        if (input) input.value = value;
    });
}

function renderTopics(topics) {
    topicCount.textContent = `${topics.length} ${topics.length === 1 ? "topic" : "topics"}`;
    topicManager.replaceChildren();

    topics.forEach((topic) => {
        const item = document.createElement("article");
        item.className = "topic-manager-item";
        item.innerHTML = `
            <div>
                <strong>${escapeHtml(topic.name)}</strong>
                <p>${escapeHtml(topic.description || "No description yet.")}</p>
            </div>
            <button class="topic-delete" type="button" data-topic-id="${escapeHtml(topic.id)}">Remove</button>
        `;
        topicManager.appendChild(item);
    });

    topicManager.querySelectorAll(".topic-delete").forEach((button) => {
        button.addEventListener("click", async () => {
            try {
                await request(`/api/admin/topics/${encodeURIComponent(button.dataset.topicId)}`, { method: "DELETE" });
                await refreshContent();
                topicStatus.textContent = "Topic removed.";
            } catch (error) {
                topicStatus.textContent = error.message;
            }
        });
    });
}

async function refreshContent() {
    const content = await request("/api/content");
    fillSettingsForm(content.settings);
    renderTopics(content.topics);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter || loginForm.querySelector("button");
    button.disabled = true;
    loginStatus.textContent = "Signing in…";
    try {
        await request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: document.getElementById("loginEmail").value,
                password: document.getElementById("loginPassword").value
            })
        });
        await refreshContent();
        showAdmin();
        loginForm.reset();
        loginStatus.textContent = "";
        document.getElementById("adminName").focus({ preventScroll: true });
    } catch (error) {
        loginStatus.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsForm);
    try {
        await request("/api/admin/settings", {
            method: "PUT",
            body: JSON.stringify(Object.fromEntries(formData.entries()))
        });
        settingsStatus.textContent = "Information saved to the database.";
    } catch (error) {
        settingsStatus.textContent = error.message;
    }
});

topicForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(topicForm);
    try {
        await request("/api/admin/topics", {
            method: "POST",
            body: JSON.stringify({
                name: formData.get("topicName"),
                description: formData.get("topicDescription")
            })
        });
        topicForm.reset();
        await refreshContent();
        topicStatus.textContent = "Topic added to the database.";
    } catch (error) {
        topicStatus.textContent = error.message;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutStatus.textContent = "";
    try {
        await request("/api/auth/logout", { method: "POST" });
        showLogin();
        loginStatus.textContent = "You have been signed out.";
        document.getElementById("loginEmail").focus();
    } catch (error) {
        logoutStatus.textContent = error.message;
    } finally {
        logoutButton.disabled = false;
    }
});

document.getElementById("resetSettings").addEventListener("click", async () => {
    try {
        await request("/api/admin/settings", {
            method: "PUT",
            body: JSON.stringify(defaultSettings)
        });
        await refreshContent();
        settingsStatus.textContent = "Default information restored.";
    } catch (error) {
        settingsStatus.textContent = error.message;
    }
});

request("/api/auth/me")
    .then(async () => {
        await refreshContent();
        showAdmin();
    })
    .catch(() => showLogin());

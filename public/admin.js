const defaultSettings = {
    name: "Dhruv Bajaj",
    kicker: "Dhruv Bajaj",
    heroTitle: "Ideas, projects, and notes in one clean place.",
    heroDescription: "A personal blog for code, college life, routines, and the details I want to remember.",
    aboutTitle: "I like making ideas easier to see, use, and remember.",
    aboutDescription: "I am a student exploring front-end engineering, design, and the habit of writing things down before they disappear."
};

const loginPanel = document.getElementById("adminLogin");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const loginButton = loginForm.querySelector('[type="submit"]');
const passwordInput = document.getElementById("loginPassword");
const passwordToggle = document.getElementById("passwordToggle");
const logoutButton = document.getElementById("logoutButton");
const logoutStatus = document.getElementById("logoutStatus");
const dashboardLoad = document.getElementById("dashboardLoad");
const dashboardStatus = document.getElementById("dashboardStatus");
const dashboardRetry = document.getElementById("dashboardRetry");
const adminContent = document.getElementById("adminContent");
const settingsForm = document.getElementById("siteSettingsForm");
const settingsStatus = document.getElementById("settingsStatus");
const resetSettings = document.getElementById("resetSettings");
const topicForm = document.getElementById("topicForm");
const topicManager = document.getElementById("topicManager");
const topicCount = document.getElementById("topicCount");
const topicsEmpty = document.getElementById("topicsEmpty");
const topicStatus = document.getElementById("topicStatus");
let savedSettings;

function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.toggleAttribute("data-error", isError);
}

async function request(url, method = "GET", body) {
    let response;
    try {
        response = await fetch(url, {
            method,
            ...(body && {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
        });
    } catch {
        throw new Error("Couldn’t connect. Check your connection and try again.");
    }

    if (response.status === 204) return null;
    const data = response.headers.get("content-type")?.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
    if (!response.ok || !data) {
        const message = data?.error || "The admin service is temporarily unavailable. Try again in a moment.";
        throw Object.assign(new Error(message), { status: response.status });
    }
    return data;
}

function readForm(form) {
    return Object.fromEntries(new FormData(form));
}

function fillSettingsForm(settings) {
    for (const [key, value] of Object.entries(settings)) {
        settingsForm.elements.namedItem(key).value = value;
    }
}

function hasUnsavedSettings() {
    return savedSettings && Object.keys(savedSettings).some(key =>
        settingsForm.elements.namedItem(key).value !== savedSettings[key]
    );
}

function updateTopicCount() {
    const count = topicManager.children.length;
    topicCount.textContent = `${count} ${count === 1 ? "topic" : "topics"}`;
    topicsEmpty.hidden = count > 0;
}

function createTopicItem(topic) {
    const item = document.createElement("article");
    item.className = "topic-manager-item";
    item.setAttribute("role", "listitem");

    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = topic.name;
    copy.append(name);
    if (topic.description) {
        const description = document.createElement("p");
        description.textContent = topic.description;
        copy.append(description);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "topic-delete";
    remove.dataset.topicId = topic.id;
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${topic.name}`);

    item.append(copy, remove);
    return item;
}

function setLoginBusy(busy) {
    loginButton.disabled = busy;
    loginForm.setAttribute("aria-busy", String(busy));
}

function showLogin(message, isError = false) {
    loginPanel.hidden = false;
    dashboardLoad.hidden = true;
    adminContent.hidden = true;
    logoutButton.hidden = true;
    setStatus(loginStatus, message, isError);
}

async function openDashboard(focusHeading = false) {
    loginPanel.hidden = true;
    dashboardLoad.hidden = false;
    dashboardRetry.hidden = true;
    logoutButton.hidden = false;
    logoutButton.disabled = true;
    setStatus(dashboardStatus, "Loading site content…");
    try {
        const content = await request("/api/content");
        if (!content?.settings || !Array.isArray(content.topics)) {
            throw new Error("Site content could not be read.");
        }
        const settings = Object.fromEntries(Object.entries(defaultSettings).map(([key, fallback]) =>
            [key, content.settings[key] ?? fallback]
        ));
        if (!hasUnsavedSettings()) fillSettingsForm(settings);
        savedSettings = settings;
        topicManager.replaceChildren(...content.topics.map(createTopicItem));
        updateTopicCount();
        dashboardLoad.hidden = true;
        adminContent.hidden = false;
        if (focusHeading) document.getElementById("settingsTitle").focus();
    } catch (error) {
        setStatus(dashboardStatus, error.message, true);
        dashboardRetry.hidden = false;
        if (focusHeading) dashboardRetry.focus();
    } finally {
        logoutButton.disabled = false;
    }
}

function reportEditError(error, status) {
    if (error.status === 401) {
        showLogin("Your session expired. Sign in again to continue.", true);
        document.getElementById("loginEmail").focus();
    } else {
        setStatus(status, error.message, true);
    }
}

function setEditingBusy(form, busy) {
    form.setAttribute("aria-busy", String(busy));
    form.querySelectorAll("button").forEach(button => { button.disabled = busy; });
    if (form === topicForm) {
        topicManager.querySelectorAll("button").forEach(button => { button.disabled = busy; });
    }
    logoutButton.disabled = [settingsForm, topicForm].some(item => item.getAttribute("aria-busy") === "true");
}

passwordToggle.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    passwordToggle.textContent = isHidden ? "Hide password" : "Show password";
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (loginButton.disabled) return;
    setLoginBusy(true);
    setStatus(loginStatus, "Signing in…");
    try {
        await request("/api/auth/login", "POST", readForm(loginForm));
        loginForm.reset();
        passwordInput.type = "password";
        passwordToggle.textContent = "Show password";
        await openDashboard(true);
    } catch (error) {
        setStatus(loginStatus, error.message, true);
    } finally {
        setLoginBusy(false);
    }
});

dashboardRetry.addEventListener("click", () => openDashboard(true));

settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (settingsForm.getAttribute("aria-busy") === "true") return;
    const draft = readForm(settingsForm);
    setEditingBusy(settingsForm, true);
    setStatus(settingsStatus, "Saving…");
    try {
        const { settings } = await request("/api/admin/settings", "PUT", draft);
        savedSettings = settings;
        const editedWhileSaving = Object.keys(draft).some(key =>
            settingsForm.elements.namedItem(key).value !== draft[key]
        );
        if (!editedWhileSaving) fillSettingsForm(savedSettings);
        setStatus(settingsStatus, editedWhileSaving
            ? "Site information saved. Newer edits are still unsaved."
            : "Site information saved.");
    } catch (error) {
        reportEditError(error, settingsStatus);
    } finally {
        setEditingBusy(settingsForm, false);
    }
});

resetSettings.addEventListener("click", () => {
    fillSettingsForm(defaultSettings);
    setStatus(settingsStatus, "Defaults loaded into the form. Save to publish them.");
});

topicForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (topicForm.getAttribute("aria-busy") === "true") return;
    const draft = readForm(topicForm);
    setEditingBusy(topicForm, true);
    setStatus(topicStatus, "Adding topic…");
    try {
        const { topic } = await request("/api/admin/topics", "POST", {
            name: draft.topicName,
            description: draft.topicDescription
        });
        topicManager.append(createTopicItem(topic));
        updateTopicCount();
        if (Object.keys(draft).every(key => topicForm.elements.namedItem(key).value === draft[key])) topicForm.reset();
        setStatus(topicStatus, `Added ${topic.name}.`);
    } catch (error) {
        reportEditError(error, topicStatus);
    } finally {
        setEditingBusy(topicForm, false);
    }
});

topicManager.addEventListener("click", async (event) => {
    const button = event.target.closest(".topic-delete");
    if (!button || button.disabled) return;
    const item = button.closest(".topic-manager-item");
    const name = item.querySelector("strong").textContent;
    const nextButton = (item.nextElementSibling || item.previousElementSibling)?.querySelector("button");
    let removed = false;
    setEditingBusy(topicForm, true);
    setStatus(topicStatus, `Removing ${name}…`);
    try {
        await request(`/api/admin/topics/${encodeURIComponent(button.dataset.topicId)}`, "DELETE");
        item.remove();
        updateTopicCount();
        removed = true;
        setStatus(topicStatus, `Removed ${name}.`);
    } catch (error) {
        reportEditError(error, topicStatus);
    } finally {
        setEditingBusy(topicForm, false);
        if (!adminContent.hidden) {
            const focusTarget = removed ? nextButton || document.getElementById("topicName") : button;
            focusTarget.focus();
        }
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    adminContent.inert = true;
    dashboardLoad.inert = true;
    setStatus(logoutStatus, "");
    try {
        await request("/api/auth/logout", "POST").catch(error => {
            if (error.status !== 401) throw error;
        });
        savedSettings = undefined;
        settingsForm.reset();
        topicForm.reset();
        setStatus(settingsStatus, "");
        setStatus(topicStatus, "");
        showLogin("You have been signed out.");
        document.getElementById("loginEmail").focus();
    } catch (error) {
        setStatus(logoutStatus, error.message, true);
    } finally {
        adminContent.inert = false;
        dashboardLoad.inert = false;
        logoutButton.disabled = false;
    }
});

async function restoreSession() {
    setLoginBusy(true);
    setStatus(loginStatus, "Checking your session…");
    try {
        await request("/api/auth/me");
        await openDashboard();
    } catch (error) {
        showLogin(error.status === 401 ? "" : error.message, error.status !== 401);
    } finally {
        setLoginBusy(false);
    }
}

passwordToggle.disabled = false;
restoreSession();

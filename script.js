const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const progressBar = document.getElementById("progressBar");
const postCards = document.querySelectorAll(".post-card");
const postSearch = document.getElementById("postSearch");
const postCount = document.getElementById("postCount");
const emptyState = document.getElementById("emptyState");
const themeToggle = document.getElementById("themeToggle");
const savedSummary = document.getElementById("savedSummary");
const saveButtons = document.querySelectorAll(".save-button");
const postSort = document.getElementById("postSort");
const postGrid = document.getElementById("postGrid");
const backToTop = document.getElementById("backToTop");
const readingModal = document.getElementById("readingModal");
const projectModal = document.getElementById("projectModal");
const commandPalette = document.getElementById("commandPalette");
const toast = document.getElementById("toast");
const siteTopics = document.querySelector(".filter-row");
const interestStrip = document.querySelector(".interest-strip");
let activeFilter = "all";
function readPreference(key, fallback = null) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function writePreference(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Keep the current session usable if browser storage is unavailable.
    }
}

const storedPosts = readPreference("savedPosts", []);
let savedPosts = Array.isArray(storedPosts)
    ? [...new Set(storedPosts.filter(id => typeof id === "string"))]
    : [];
let toastTimer;

async function loadPublicContent() {
    try {
        let content;
        try {
            const apiUrl = ["idhruvbajaj.github.io", "idhruvbajaj.is-a.dev"].includes(location.hostname)
                ? "https://idhruvbajaj-github-io.vercel.app/api/content"
                : "/api/content";
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Content API unavailable.");
            content = await response.json();
        } catch {
            content = {
                settings: readPreference("siteSettings"),
                topics: readPreference("siteTopics")
            };
        }

        const settings = content.settings;
        if (settings) {
            const contentMap = {
                name: "siteName",
                kicker: "siteName",
                heroTitle: "heroTitle",
                heroDescription: "heroDescription",
                aboutTitle: "aboutTitle",
                aboutDescription: "aboutDescription"
            };
            Object.entries(contentMap).forEach(([settingKey, elementId]) => {
                const element = document.getElementById(elementId);
                if (element && settings[settingKey]) element.textContent = settings[settingKey];
            });
        }

        const topics = content.topics;
        if (Array.isArray(topics) && siteTopics) {
            topics.forEach((topic) => {
                if ([...siteTopics.children].some(chip => chip.dataset.filter === topic.id)) return;
                const button = document.createElement("button");
                button.className = "filter-chip";
                button.type = "button";
                button.dataset.filter = topic.id;
                button.setAttribute("aria-pressed", "false");
                button.textContent = topic.name;
                siteTopics.appendChild(button);

                const interest = document.createElement("span");
                interest.textContent = topic.name;
                interestStrip?.appendChild(interest);
            });
        }
    } catch (error) {
        console.warn("Could not load local site content. Using defaults.", error);
    }
}

const articles = {
    "javascript-patterns": {
        category: "Code · 6 min read",
        title: "JavaScript patterns I finally understand.",
        lede: "The clearest way to learn a pattern is to meet it while building something small.",
        body: [
            "For a long time, event handling, state, and DOM updates felt like separate topics. Working on small interfaces showed me that they are really parts of one loop: something changes, the interface notices, and the screen catches up.",
            "The useful shift was to keep state in one obvious place and let events describe intent. That makes a button click easier to follow and a future change less risky.",
            "I am still learning, but the code feels more approachable now: smaller functions, names that explain the why, and fewer surprises hidden inside a click handler."
        ]
    },
    "class-projects": {
        category: "College · 5 min read",
        title: "Keeping class projects calm and finished.",
        lede: "A project becomes manageable when its next step is visible.",
        body: [
            "I used to treat a class project as one giant task. That made every study session feel like starting from zero. Now I break it into small deliverables that can each be finished and checked.",
            "The biggest improvement is leaving a little space for polish. A working submission is important, but a final pass for hierarchy, labels, and edge cases is where the work starts to feel intentional."
        ]
    },
    "daily-routines": {
        category: "Life · 4 min read",
        title: "Building better daily routines.",
        lede: "The best routine is not the most ambitious one; it is the one that survives an ordinary day.",
        body: [
            "A routine should reduce decisions, not create another performance to keep up with. I start with anchors: sleep, meals, movement, and one meaningful block of focused work.",
            "When the day gets messy, I return to the smallest version of the habit. Ten minutes of reading still counts. A short walk still changes the afternoon. Consistency grows from those low-pressure returns."
        ]
    },
    "fast-focused": {
        category: "Code · 7 min read",
        title: "Making a page feel fast and focused.",
        lede: "Speed is partly technical, but it is also the feeling that nothing is asking for attention unnecessarily.",
        body: [
            "Clear layout, strong spacing, and a short visual path can make a page feel faster before a single performance metric changes. The user should know where they are and what they can do next.",
            "I look for unnecessary movement, competing calls to action, and components that appear before they are useful. Removing those things is often more powerful than adding another effect."
        ]
    }
};

function updateProgressBar() {
    const scrollTop = window.scrollY;
    const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = pageHeight > 0 ? (scrollTop / pageHeight) * 100 : 0;
    progressBar.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
}

function setMenu(open) {
    siteNav.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuToggle.addEventListener("click", () => setMenu(!siteNav.classList.contains("open")));
siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) setMenu(false);
});
matchMedia("(max-width: 860px)").addEventListener("change", () => setMenu(false));

function applyPostFilters() {
    const query = postSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    postCards.forEach((card) => {
        const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
        const matchesSearch = !query || card.querySelector(".post-content").textContent.toLowerCase().includes(query);
        const shouldShow = matchesFilter && matchesSearch;

        card.classList.toggle("hidden", !shouldShow);
        if (shouldShow) visibleCount += 1;
    });

    postCount.textContent = `${visibleCount} ${visibleCount === 1 ? "post" : "posts"}`;
    emptyState.hidden = visibleCount > 0;
}

function sortPosts() {
    const cards = [...postCards];
    if (postSort.value === "shortest" || postSort.value === "longest") {
        cards.sort((a, b) => {
            const aMinutes = parseInt(a.querySelector(".post-meta span").textContent, 10);
            const bMinutes = parseInt(b.querySelector(".post-meta span").textContent, 10);
            return postSort.value === "shortest" ? aMinutes - bMinutes : bMinutes - aMinutes;
        });
    } else {
        cards.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
    }
    cards.forEach((card) => postGrid.appendChild(card));
}

siteTopics.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (!button || !siteTopics.contains(button)) return;
    siteTopics.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
        chip.setAttribute("aria-pressed", String(chip === button));
    });
    activeFilter = button.dataset.filter;
    applyPostFilters();
});

postSearch.addEventListener("input", applyPostFilters);
postSort.addEventListener("change", () => {
    sortPosts();
    applyPostFilters();
});

function updateSavedState() {
    saveButtons.forEach((button) => {
        const isSaved = savedPosts.includes(button.dataset.save);
        button.setAttribute("aria-pressed", String(isSaved));
        button.textContent = isSaved ? "♥ Saved" : "♡ Save";
    });
    savedSummary.textContent = `${savedPosts.length} saved ${savedPosts.length === 1 ? "post" : "posts"}`;
}

saveButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const postId = button.dataset.save;
        savedPosts = savedPosts.includes(postId)
            ? savedPosts.filter((id) => id !== postId)
            : [...savedPosts, postId];
        writePreference("savedPosts", savedPosts);
        updateSavedState();
    });
});

function setTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.querySelector("span").textContent = isDark ? "☀" : "☾";
}

const colorPreference = matchMedia("(prefers-color-scheme: dark)");
colorPreference.addEventListener("change", () => {
    if (readPreference("darkMode") === null) setTheme(colorPreference.matches);
});
themeToggle.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-mode");
    setTheme(isDark);
    writePreference("darkMode", isDark);
});

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
loadPublicContent();

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

const dialogs = [readingModal, projectModal, commandPalette];

function openModal(modal, trigger) {
    if (dialogs.some(dialog => dialog.open)) return;
    setMenu(false);
    trigger?.focus({ preventScroll: true });
    modal.showModal();
    document.body.classList.add("modal-open");
    modal.querySelector(".modal-card, .palette-card").scrollTop = 0;
}

dialogs.forEach((modal) => {
    modal.addEventListener("close", () => {
        document.body.classList.toggle("modal-open", dialogs.some(dialog => dialog.open));
    });
});

document.querySelectorAll(".read-post").forEach((button) => {
    button.addEventListener("click", () => {
        const article = articles[button.dataset.read];
        if (!article) return;
        document.getElementById("readingCategory").textContent = article.category;
        document.getElementById("readingTitle").textContent = article.title;
        document.getElementById("readingLede").textContent = article.lede;
        document.getElementById("readingBody").innerHTML = article.body.map((paragraph) => `<p>${paragraph}</p>`).join("");
        document.getElementById("readingSave").dataset.save = button.dataset.read;
        updateSavedState();
        openModal(readingModal, button);
    });
});

document.querySelectorAll(".project-details").forEach((button) => {
    button.addEventListener("click", () => {
        const descriptions = {
            Focusboard: "A small experiment in making progress visible without making the interface loud.",
            "Field notes": "A lightweight publishing system for turning scattered thoughts into useful, searchable notes.",
            "Web lab": "A collection of focused frontend experiments exploring motion, accessibility, and performance."
        };
        document.getElementById("projectTitle").textContent = button.dataset.project;
        document.getElementById("projectDescription").textContent = descriptions[button.dataset.project];
        openModal(projectModal, button);
    });
});

document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", () => readingModal.close());
});
document.querySelectorAll("[data-close-project]").forEach((element) => {
    element.addEventListener("click", () => projectModal.close());
});
document.querySelectorAll("[data-close-command]").forEach((element) => {
    element.addEventListener("click", () => commandPalette.close());
});

document.querySelectorAll(".copy-note").forEach((button) => {
    button.addEventListener("click", async () => {
        const note = button.closest(".note-card").querySelector("p").textContent;
        try {
            await navigator.clipboard.writeText(note);
            showToast("Note copied to your clipboard.");
        } catch {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(button.closest(".note-card").querySelector("p"));
            selection.removeAllRanges();
            selection.addRange(range);
            if (document.execCommand?.("copy")) {
                selection.removeAllRanges();
                showToast("Note copied to your clipboard.");
            } else {
                showToast("Note selected. Use your device’s Copy command.");
            }
        }
    });
});

backToTop.addEventListener("click", () => {
    document.querySelector(".site-header .brand").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: motionQuery.matches ? "auto" : "smooth" });
});

function openCommandPalette(event) {
    openModal(commandPalette, event?.currentTarget);
}

function runCommand(command) {
    const targets = {
        posts: "#posts",
        projects: "#projects",
        newsletter: "#newsletter",
        top: "#home"
    };
    if (command === "theme") {
        commandPalette.close();
        themeToggle.click();
        showToast("Theme updated.");
    } else if (targets[command]) {
        commandPalette.close();
        const target = document.querySelector(targets[command]);
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: motionQuery.matches ? "auto" : "smooth" });
    }
}

document.getElementById("commandButton").addEventListener("click", openCommandPalette);
document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command));
});
document.getElementById("commandSearch").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll("[data-command]").forEach((button) => {
        button.hidden = !button.textContent.toLowerCase().includes(query);
    });
});

function updateScrollControls() {
    updateProgressBar();
    const showBackToTop = window.scrollY > 600;
    backToTop.hidden = !showBackToTop;
    backToTop.classList.toggle("visible", showBackToTop);
}

window.addEventListener("scroll", updateScrollControls, { passive: true });
window.addEventListener("resize", updateScrollControls, { passive: true });
document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (dialogs.some(dialog => dialog.open && dialog !== commandPalette)) return;
        event.preventDefault();
        openCommandPalette();
    } else if (event.key === "Escape" && siteNav.classList.contains("open")) {
        setMenu(false);
        menuToggle.focus();
    }
});
setTheme(readPreference("darkMode", colorPreference.matches));
postCards.forEach((card, index) => card.dataset.order = String(index));
sortPosts();
updateSavedState();
applyPostFilters();
updateScrollControls();

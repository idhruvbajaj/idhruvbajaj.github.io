const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const progressBar = document.getElementById("progressBar");
const filterButtons = document.querySelectorAll(".filter-chip");
const postCards = document.querySelectorAll(".post-card");
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
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
const newsletterForm = document.getElementById("newsletterForm");
const newsletterStatus = document.getElementById("newsletterStatus");
const siteTopics = document.querySelector(".filter-row");
const interestStrip = document.querySelector(".interest-strip");
let activeFilter = "all";
let savedPosts = JSON.parse(localStorage.getItem("savedPosts") || "[]");
let toastTimer;

async function loadPublicContent() {
    try {
        let content;
        try {
            const response = await fetch("/api/content");
            if (!response.ok) throw new Error("Content API unavailable.");
            content = await response.json();
        } catch {
            content = {
                settings: JSON.parse(localStorage.getItem("siteSettings") || "null"),
                topics: JSON.parse(localStorage.getItem("siteTopics") || "null")
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
                if (siteTopics.querySelector(`[data-filter="${topic.id}"]`)) return;
                const button = document.createElement("button");
                button.className = "filter-chip";
                button.type = "button";
                button.dataset.filter = topic.id;
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
    progressBar.style.width = `${Math.min(progress, 100)}%`;
}

menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
        siteNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
});

function applyPostFilters() {
    const query = postSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    postCards.forEach((card) => {
        const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
        const matchesSearch = !query || card.dataset.title.toLowerCase().includes(query);
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

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((chip) => {
            chip.classList.toggle("active", chip === button);
        });
        activeFilter = button.dataset.filter;
        applyPostFilters();
    });
});

siteTopics.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (!button || !siteTopics.contains(button)) return;
    siteTopics.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
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
    localStorage.setItem("savedPosts", JSON.stringify(savedPosts));
}

saveButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const postId = button.dataset.save;
        savedPosts = savedPosts.includes(postId)
            ? savedPosts.filter((id) => id !== postId)
            : [...savedPosts, postId];
        updateSavedState();
    });
});

function setTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.querySelector("span").textContent = isDark ? "☀" : "☾";
    localStorage.setItem("darkMode", String(isDark));
}

themeToggle.addEventListener("click", () => {
    setTheme(!document.body.classList.contains("dark-mode"));
});

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".hero");

function resetDepth() {
    hero?.style.removeProperty("--hero-x");
    hero?.style.removeProperty("--hero-y");
    hero?.style.removeProperty("--visual-x");
    hero?.style.removeProperty("--visual-y");
    hero?.style.removeProperty("--orb-x");
    hero?.style.removeProperty("--orb-y");
}

if (hero && !motionQuery.matches) {
    hero.addEventListener("pointermove", (event) => {
        const bounds = hero.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        hero.style.setProperty("--hero-x", `${x * -14}px`);
        hero.style.setProperty("--hero-y", `${y * -10}px`);
        hero.style.setProperty("--visual-x", `${x * 18}px`);
        hero.style.setProperty("--visual-y", `${y * 12}px`);
        hero.style.setProperty("--orb-x", `${x * 90}px`);
        hero.style.setProperty("--orb-y", `${y * 58}px`);
        hero.style.setProperty("--ring-rotation", `${x * 18}deg`);
    });
    hero.addEventListener("pointerleave", resetDepth);
}

const revealItems = document.querySelectorAll(
    ".latest-panel, .post-showcase, .platform-panel, .about-panel, .notes-panel, .newsletter-panel, .contact-panel"
);

if (motionQuery.matches) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
    revealItems.forEach((item) => item.classList.add("reveal"));
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => revealObserver.observe(item));
}

window.addEventListener("blur", resetDepth);
loadPublicContent();

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function openModal(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const closeButton = modal.querySelector(".modal-close");
    closeButton?.focus();
}

function closeModal(modal) {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
}

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
        openModal(readingModal);
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
        openModal(projectModal);
    });
});

document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", () => closeModal(readingModal));
});
document.querySelectorAll("[data-close-project]").forEach((element) => {
    element.addEventListener("click", () => closeModal(projectModal));
});
document.querySelectorAll("[data-close-command]").forEach((element) => {
    element.addEventListener("click", () => closeModal(commandPalette));
});

document.querySelectorAll(".copy-note").forEach((button) => {
    button.addEventListener("click", async () => {
        const note = button.closest(".note-card").querySelector("p").textContent;
        try {
            await navigator.clipboard.writeText(note);
            showToast("Note copied to your clipboard.");
        } catch {
            showToast("Copy is unavailable in this browser.");
        }
    });
});

backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

function openCommandPalette() {
    openModal(commandPalette);
    document.getElementById("commandSearch").focus();
}

function runCommand(command) {
    const targets = {
        posts: "#posts",
        projects: "#projects",
        newsletter: "#newsletter",
        top: "#home"
    };
    if (command === "theme") {
        themeToggle.click();
        showToast("Theme updated.");
    } else if (targets[command]) {
        closeModal(commandPalette);
        document.querySelector(targets[command]).scrollIntoView({ behavior: "smooth" });
    }
}

document.getElementById("commandButton").addEventListener("click", openCommandPalette);
document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command));
});
document.getElementById("commandSearch").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll("[data-command]").forEach((button) => {
        button.hidden = !button.textContent.toLowerCase().includes(query);
    });
});

newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    newsletterStatus.textContent = "You’re on the list. Thanks for joining.";
    newsletterForm.reset();
    showToast("Newsletter signup saved locally.");
});

contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!name || !email || !message) {
        formStatus.textContent = "Please complete your name, email, and message.";
        return;
    }

    const topic = String(formData.get("topic") || "your note").toLowerCase();
    formStatus.textContent = `Thanks, ${name}. I’ll get back to you about ${topic}.`;
    contactForm.reset();
});

window.addEventListener("scroll", updateProgressBar, { passive: true });
window.addEventListener("scroll", () => backToTop.classList.toggle("visible", window.scrollY > 600), { passive: true });
document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCommandPalette();
    } else if (event.key === "Escape") {
        [readingModal, projectModal, commandPalette].forEach((modal) => {
            if (!modal.hidden) closeModal(modal);
        });
    } else if (!event.target.matches("input, textarea, select")) {
        const shortcuts = { p: "posts", j: "projects", t: "theme", n: "newsletter", g: "top" };
        if (shortcuts[key]) runCommand(shortcuts[key]);
    }
});
setTheme(localStorage.getItem("darkMode") === "true");
postCards.forEach((card, index) => card.dataset.order = String(index));
sortPosts();
updateSavedState();
applyPostFilters();
updateProgressBar();

let allQuestions = [];
let allCompanies = [];
let selectedCompanies = new Set();
let activeUrl = "";
let companyPanelOpen = false;

// Faster Init: Immediate Fetch
const savedUrl = localStorage.getItem("lc_tracker_url");
if (savedUrl) {
  loadData(savedUrl);
} else {
  document.addEventListener("DOMContentLoaded", showModal);
}

function debounce(func, timeout = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

function showModal() {
  document.getElementById("modal-container").style.display = "flex";
  document.getElementById("modal-dialog").style.display = "block";
  document.getElementById("loading-overlay").style.display = "none";
}

function showLoading() {
  document.getElementById("modal-container").style.display = "flex";
  document.getElementById("modal-dialog").style.display = "none";
  document.getElementById("loading-overlay").style.display = "flex";
}

function hideModal() {
  document.getElementById("modal-container").style.display = "none";
  document.getElementById("app").style.display = "block";
}

function showInfoModal() {
  document.getElementById("modal-container").style.display = "flex";
  document.getElementById("modal-dialog").style.display = "none";
  document.getElementById("loading-overlay").style.display = "none";
  document.getElementById("info-modal").style.display = "block";
}

function hideInfoModal() {
  document.getElementById("modal-container").style.display = "none";
  document.getElementById("info-modal").style.display = "none";
}

async function loadData(providedUrl = null) {
  const url = providedUrl || document.getElementById("json-url").value.trim();
  if (!url) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLoading);
  } else {
    showLoading();
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    allQuestions = data;
    activeUrl = url;
    localStorage.setItem("lc_tracker_url", url);

    setTimeout(() => {
      processData();
      hideModal();
      // document.getElementById("footer-url").textContent = truncate(url, 60);
      toast(
        `Loaded ${allQuestions.length} questions from ${truncate(url, 60)}`,
        "success",
      );
      try {
        document.getElementById("data-source-badge").textContent = new URL(
          url,
        ).hostname;
      } catch (_) {
        // document.getElementById("data-source-badge").textContent = "local";
        document.getElementById("data-source-badge").textContent = "data.json";
      }
      const li = document.getElementById("live-indicator");
      li.classList.add("active");
      li.textContent = `${allQuestions.length} loaded`;
      applyFilters();
    }, 0);
  } catch (e) {
    if (document.readyState !== "loading") showModal();
    const errEl = document.getElementById("modal-error");
    if (errEl) {
      errEl.textContent = `Error: ${e.message}`;
      errEl.classList.add("show");
    }
  }
}

function processData() {
  const companyMap = new Map();
  // normalize the title so we can search easily
  allQuestions = allQuestions.map((q) => ({
    ...q,
    normalizedTitle: (q.title || "").toLowerCase().replace(/-/g, " "),
  }));

  allQuestions.forEach((q) => {
    (q.companies || []).forEach((c) => {
      companyMap.set(c, (companyMap.get(c) || 0) + 1);
    });
  });
  allCompanies = [...companyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  document.getElementById("stat-total").textContent = allQuestions.length;
  document.getElementById("stat-companies").textContent = allCompanies.length;
  renderChips();
}

function toggleCompanyPanel() {
  companyPanelOpen = !companyPanelOpen;
  document
    .getElementById("company-chips-wrap")
    .classList.toggle("open", companyPanelOpen);
  document
    .getElementById("company-toggle")
    .classList.toggle("open", companyPanelOpen);
}

function renderChips() {
  const container = document.getElementById("company-chips");
  // let html = `<span class="chip all ${selectedCompanies.size === 0 ? "active" : ""}" onclick="selectedCompanies.clear(); renderChips(); applyFilters();">All <span class="count">${allQuestions.length}</span></span>`;

  // allCompanies.forEach(({ name, count }) => {
  //   html += `<span class="chip ${selectedCompanies.has(name) ? "active" : ""}" onclick="event.stopPropagation(); selectedCompanies.has('${name}') ? selectedCompanies.delete('${name}') : selectedCompanies.add('${name}'); renderChips(); applyFilters();">${name} <span class="count">${count}</span></span>`;
  // });
  // container.innerHTML = html;

  let html = `<span class="chip all ${selectedCompanies.size === 0 ? "active" : ""}" data-action="clear-chips">All <span class="count">${allQuestions.length}</span></span>`;
  allCompanies.forEach(({ name, count }) => {
    html += `<span class="chip ${selectedCompanies.has(name) ? "active" : ""}" data-company="${name}">${name} <span class="count">${count}</span></span>`;
  });
  container.innerHTML = html;

  const badge = document.getElementById("active-count-badge");
  const toggle = document.getElementById("company-toggle");
  const summary = document.getElementById("cft-summary");
  if (selectedCompanies.size > 0) {
    badge.textContent = `${selectedCompanies.size} selected`;
    badge.classList.add("show");
    toggle.classList.add("has-active");
    summary.textContent =
      [...selectedCompanies].slice(0, 2).join(", ") +
      (selectedCompanies.size > 2 ? ` +${selectedCompanies.size - 2}` : "");
  } else {
    badge.classList.remove("show");
    toggle.classList.remove("has-active");
    summary.textContent = `${allCompanies.length} companies`;
  }
}

function applyFilters() {
  const rawQuery = document
    .getElementById("search-input")
    .value.trim()
    .toLowerCase();
  const showNoCompany = document.getElementById("show-no-company").checked;

  let filtered = allQuestions.filter((q) => {
    // if (rawQuery) {
    //   const title = (q.title || "").toLowerCase().replace(/-/g, " ");
    //   if (!title.includes(rawQuery)) return false;
    // }

    // already normalize in the process data func
    if (rawQuery) {
      if (!q.normalizedTitle.includes(rawQuery)) return false;
    }
    if (selectedCompanies.size > 0) {
      return (q.companies || []).some((c) => selectedCompanies.has(c));
    }
    if (!showNoCompany && (!q.companies || q.companies.length === 0))
      return false;
    return true;
  });

  renderList(filtered);
  document.getElementById("stat-showing").textContent = filtered.length;
}

// Use ResizeObserver for asynchronous, high-performance height checks
const overflowObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const target = entry.target;
    const btnId = target.id.replace("q-inner-", "q-btn-");
    const btn = document.getElementById(btnId);
    if (btn) {
      // Toggle display block/none based on overflow
      if (target.scrollHeight > 22) {
        btn.style.display = "inline-flex";
      } else {
        btn.style.display = "none";
      }
    }
  }
});

function renderList(questions) {
  const container = document.getElementById("q-list");
  if (questions.length === 0) {
    container.innerHTML =
      '<div class="empty-state">No questions match filters.</div>';
    return;
  }

  let html = "";
  questions.forEach((q, i) => {
    const companies = q.companies || [];
    const titleText = (q.title || "").replace(/-/g, " ");
    let compTags = "";

    if (companies.length === 0) {
      compTags = `<span class="no-company-tag">no company tag</span>`;
    } else {
      compTags = companies
        .map(
          (c) =>
            `<span class="co-tag ${selectedCompanies.has(c) ? "highlighted" : ""}">${c}</span>`,
        )
        .join("");
    }

    // <button class="q-expand-btn" id="q-btn-${i}" onclick="toggleQCompanies(${i}, this)"><i class="chev">▾</i></button>
    html += `
    <div class="q-entry">
      <div class="q-num">${String(i + 1).padStart(3, "0")}</div>
      <div class="q-body">
        <div class="q-title"><a href="${q.url}" target="_blank" rel="noopener">${titleText}</a></div>
        <div class="q-companies">
          <div class="q-companies-inner" id="q-inner-${i}">${compTags}</div>
          <button class="q-expand-btn" id="q-btn-${i}" data-expand-idx="${i}"><i class="chev">▾</i></button>
        </div>
      </div>
      <div class="q-link-icon"><a href="${q.url}" target="_blank" rel="noopener">↗</a></div>
    </div>`;
  });
  container.innerHTML = html;

  // Observe all new rows
  questions.forEach((q, i) => {
    const el = document.getElementById(`q-inner-${i}`);
    if (el) overflowObserver.observe(el);
  });
}

function clearFilters() {
  selectedCompanies.clear();
  document.getElementById("search-input").value = "";
  document.getElementById("show-no-company").checked = false;
  renderChips();
  applyFilters();
}

function reloadUrl() {
  showModal();
  if (activeUrl) document.getElementById("json-url").value = activeUrl;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function toast(msg, type = "info") {
  const host = document.getElementById("toast-host");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// event listner
document.getElementById("load-btn").addEventListener("click", () => {
  loadData();
});
document.getElementById("reload-url").addEventListener("click", () => {
  reloadUrl();
});
document.getElementById("clear-filters").addEventListener("click", () => {
  clearFilters();
});
// document.getElementById("search-input").addEventListener("input", () => {
//   applyFilters();
// });

// reduce lag using the debounce
document.getElementById("search-input").addEventListener(
  "input",
  debounce(() => {
    applyFilters();
  }, 250),
);
document.getElementById("show-no-company").addEventListener("change", () => {
  applyFilters();
});

document.getElementById("company-toggle").addEventListener("click", () => {
  toggleCompanyPanel();
});

document.getElementById("about").addEventListener("click", showInfoModal);

document.getElementById("close-about-btn").addEventListener("click", hideInfoModal);

document.addEventListener("click", (e) => {
  // handle expand button click toggleQCompanies
  const expandBtn = e.target.closest("[data-expand-idx]");
  if (expandBtn) {
    const idx = expandBtn.getAttribute("data-expand-idx");
    const inner = document.getElementById(`q-inner-${idx}`);
    const isOpen = inner.classList.toggle("expanded");
    expandBtn.classList.toggle("open", isOpen);
    return;
  }

  // handle company chip Clicks
  const chip = e.target.closest(".chip");
  if (chip) {
    if (chip.hasAttribute("data-action")) {
      selectedCompanies.clear();
    } else {
      const name = chip.getAttribute("data-company");
      if (selectedCompanies.has(name)) {
        selectedCompanies.delete(name);
      } else {
        selectedCompanies.add(name);
      }
    }
    renderChips();
    applyFilters();
  }
});

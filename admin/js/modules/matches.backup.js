import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db, auth } from "../../../js/firebase.js";

const API_BASE = "http://localhost:3000";

let currentMatches = [];
let currentFilter = "all";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusLabel(status) {
  const map = {
    NS: "Not Started",
    "1H": "1st Half",
    HT: "Half Time",
    "2H": "2nd Half",
    ET: "Extra Time",
    BT: "Break",
    P: "Penalties",
    FT: "Finished",
    AET: "Finished AET",
    PEN: "Finished Pens",
    PST: "Postponed",
    CANC: "Cancelled",
    ABD: "Abandoned",
    AWD: "Awarded",
    WO: "Walkover"
  };

  return map[status] || status || "Unknown";
}

function statusClass(status) {
  if (["1H", "2H", "ET", "P"].includes(status)) {
    return "bg-red-500/10 text-red-400";
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "bg-green-500/10 text-green-400";
  }

  if (["HT", "BT"].includes(status)) {
    return "bg-yellow-500/10 text-yellow-400";
  }

  return "bg-blue-500/10 text-blue-400";
}

function formatMatchDate(dateString) {
  if (!dateString) return "-";

  try {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return dateString;
  }
}

function getFilteredMatches() {
  if (currentFilter === "live") {
    return currentMatches.filter(match =>
      ["1H", "2H", "ET", "BT", "P"].includes(match.status?.short)
    );
  }

  if (currentFilter === "finished") {
    return currentMatches.filter(match =>
      ["FT", "AET", "PEN"].includes(match.status?.short)
    );
  }

  if (currentFilter === "upcoming") {
    return currentMatches.filter(match =>
      ["NS", "TBD"].includes(match.status?.short)
    );
  }

  return currentMatches;
}

function renderMatches() {
  const container = document.getElementById("matchesList");

  if (!container) return;

  const matches = getFilteredMatches();

  if (!matches.length) {
    container.innerHTML = `
      <div class="p-10 text-center text-gray-500">
        <i class="fa-solid fa-futbol text-4xl mb-4"></i>
        <p>No matches found.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map(match => {
    const status = match.status?.short || "";
    const isLive = ["1H", "2H", "ET", "P"].includes(status);

    return `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-3">

        <div class="flex items-center justify-between gap-3 mb-4">

          <div class="text-xs text-gray-500">
            ${escapeHtml(match.league?.name || "Unknown League")}
            ${match.league?.country
              ? ` · ${escapeHtml(match.league.country)}`
              : ""}
          </div>

          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${statusClass(status)}">
            ${isLive ? "🔴 " : ""}
            ${escapeHtml(statusLabel(status))}
          </span>

        </div>

        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">

          <div class="text-center">

            <img
              src="${escapeHtml(match.home?.logo || "")}"
              class="w-12 h-12 object-contain mx-auto mb-2"
              onerror="this.style.display='none'"
            >

            <div class="font-bold text-sm">
              ${escapeHtml(match.home?.name || "Home")}
            </div>

          </div>

          <div class="text-center">

            <div class="text-2xl font-black">
              ${match.goals?.home ?? 0}
              <span class="text-gray-600 mx-1">:</span>
              ${match.goals?.away ?? 0}
            </div>

            ${
              isLive && match.status?.elapsed != null
                ? `<div class="text-red-400 text-xs font-bold mt-1">
                    ${match.status.elapsed}'
                  </div>`
                : ""
            }

          </div>

          <div class="text-center">

            <img
              src="${escapeHtml(match.away?.logo || "")}"
              class="w-12 h-12 object-contain mx-auto mb-2"
              onerror="this.style.display='none'"
            >

            <div class="font-bold text-sm">
              ${escapeHtml(match.away?.name || "Away")}
            </div>

          </div>

        </div>

        <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">

          <div class="text-xs text-gray-500">
            <i class="fa-regular fa-clock mr-1"></i>
            ${formatMatchDate(match.fixture?.date)}
          </div>

          <button
            onclick="window.viewFootballMatch(${match.fixtureId})"
            class="text-xs font-bold text-blue-400 hover:text-blue-300"
          >
            Details →
          </button>

        </div>

      </div>
    `;
  }).join("");
}

async function loadLiveMatches() {
  const container = document.getElementById("matchesList");

  if (container) {
    container.innerHTML = `
      <div class="p-10 text-center text-gray-500">
        <i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i>
        <p>Loading live matches...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE}/api/matches/live`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    currentMatches = data.matches || [];

    updateCounters();
    renderMatches();

  } catch (error) {
    console.error("Live matches error:", error);

    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
          <p>Unable to load live matches.</p>
          <p class="text-xs text-gray-500 mt-2">
            Make sure backend is running on port 3000.
          </p>
          <button
            onclick="window.loadFootballMatches()"
            class="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
          >
            Retry
          </button>
        </div>
      `;
    }
  }
}

async function loadDateMatches(date) {
  try {
    const response = await fetch(
      `${API_BASE}/api/matches/fixtures?date=${encodeURIComponent(date)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    currentMatches = data.matches || [];

    updateCounters();
    renderMatches();

  } catch (error) {
    console.error("Date matches error:", error);

    const container = document.getElementById("matchesList");

    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-400">
          Failed to load fixtures.
        </div>
      `;
    }
  }
}

function updateCounters() {
  const live = currentMatches.filter(m =>
    ["1H", "2H", "ET", "BT", "P"].includes(m.status?.short)
  ).length;

  const finished = currentMatches.filter(m =>
    ["FT", "AET", "PEN"].includes(m.status?.short)
  ).length;

  const upcoming = currentMatches.filter(m =>
    ["NS", "TBD"].includes(m.status?.short)
  ).length;

  const total = currentMatches.length;

  const values = {
    matchTotal: total,
    matchLive: live,
    matchUpcoming: upcoming,
    matchFinished: finished
  };

  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderUI() {
  const page = document.getElementById("pageContent");

  if (!page) {
    console.error("pageContent not found");
    return;
  }

  page.innerHTML = `
    <div class="space-y-5">

      <!-- HEADER -->

      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <h2 class="text-2xl font-black">
            Matches
          </h2>

          <p class="text-sm text-gray-500 mt-1">
            API-Football live matches and fixtures
          </p>
        </div>

        <div class="flex gap-2">

          <button
            id="refreshMatchesBtn"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
          >
            <i class="fa-solid fa-rotate mr-2"></i>
            Refresh
          </button>

          <button
            id="todayMatchesBtn"
            class="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold"
          >
            Today
          </button>

        </div>

      </div>

      <!-- STATS -->

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div class="text-xs text-gray-500">TOTAL</div>
          <div id="matchTotal" class="text-2xl font-black mt-1">0</div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div class="text-xs text-gray-500">LIVE</div>
          <div id="matchLive" class="text-2xl font-black text-red-400 mt-1">0</div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div class="text-xs text-gray-500">UPCOMING</div>
          <div id="matchUpcoming" class="text-2xl font-black text-blue-400 mt-1">0</div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div class="text-xs text-gray-500">FINISHED</div>
          <div id="matchFinished" class="text-2xl font-black text-green-400 mt-1">0</div>
        </div>

      </div>

      <!-- FILTERS -->

      <div class="flex flex-wrap gap-2">

        <button
          data-match-filter="all"
          class="match-filter px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"
        >
          All
        </button>

        <button
          data-match-filter="live"
          class="match-filter px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-bold"
        >
          🔴 Live
        </button>

        <button
          data-match-filter="upcoming"
          class="match-filter px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-bold"
        >
          📅 Upcoming
        </button>

        <button
          data-match-filter="finished"
          class="match-filter px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-bold"
        >
          ✅ Finished
        </button>

      </div>

      <!-- MATCH LIST -->

      <div id="matchesList"></div>

    </div>
  `;

  document
    .getElementById("refreshMatchesBtn")
    ?.addEventListener("click", loadLiveMatches);

  document
    .getElementById("todayMatchesBtn")
    ?.addEventListener("click", () => {
      const today = new Date().toISOString().slice(0, 10);
      loadDateMatches(today);
    });

  document.querySelectorAll("[data-match-filter]")
    .forEach(button => {
      button.addEventListener("click", () => {

        currentFilter =
          button.dataset.matchFilter;

        document.querySelectorAll(".match-filter")
          .forEach(btn => {
            btn.classList.remove(
              "bg-blue-600",
              "text-white"
            );

            btn.classList.add(
              "bg-gray-800",
              "text-gray-300"
            );
          });

        button.classList.remove(
          "bg-gray-800",
          "text-gray-300"
        );

        button.classList.add(
          "bg-blue-600",
          "text-white"
        );

        renderMatches();
      });
    });

  loadLiveMatches();
}

window.loadFootballMatches = loadLiveMatches;

window.viewFootballMatch = async function(fixtureId) {
  try {
    const response = await fetch(
      `${API_BASE}/api/matches/${fixtureId}`
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed");
    }

    const match = data.match;

    alert(
      `${match.home?.name || "Home"} ${match.goals?.home ?? 0} - ` +
      `${match.goals?.away ?? 0} ${match.away?.name || "Away"}\n\n` +
      `${match.league?.name || ""}\n` +
      `${statusLabel(match.status?.short)}`
    );

  } catch (error) {
    console.error(error);
    alert("Unable to load match details.");
  }
};

export async function loadMatchesModule() {
  renderUI();
}

export async function init() {
  renderUI();
}

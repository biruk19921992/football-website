import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const API = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3001" : "https://footballxtra-website.onrender.com";

const dateInput = document.getElementById("predictionDate");
const matchesList = document.getElementById("matchesList");
const notice = document.getElementById("predictionNotice");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardNotice = document.getElementById("leaderboardNotice");
const leaderboardRefresh = document.getElementById("refreshLeaderboard");

let currentUser = null;
let savedPredictions = {};
let loadedDate = "";

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.className = `text-sm mt-3 ${error ? "text-red-400" : "text-gray-300"}`;
}

function teamLogo(team) {
  if (!team.logo) {
    return `<div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><i class="fa-solid fa-shirt text-gray-400"></i></div>`;
  }

  return `<img src="${escapeHTML(team.logo)}" alt="" loading="lazy"
    class="w-12 h-12 object-contain"
    onerror="this.style.display='none'">`;
}

function formatKickoff(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function renderMatch(match) {
  const saved = savedPredictions[match.fixtureId];
  const locked = !match.canPredict;
  const selectedOutcome = saved?.predictedOutcome ||
    (Number.isInteger(saved?.predictedHomeGoals)
      ? (saved.predictedHomeGoals > saved.predictedAwayGoals
          ? "home"
          : saved.predictedHomeGoals < saved.predictedAwayGoals
            ? "away" : "draw")
      : "");
  const status = locked
    ? (match.statusText || "Predictions locked")
    : "Predictions open";

  return `
    <article class="glass rounded-2xl p-4" data-fixture="${escapeHTML(match.fixtureId)}">
      <div class="flex items-center justify-between gap-2 text-xs text-gray-400 mb-4">
        <span>${escapeHTML(match.league)}</span>
        <span>${escapeHTML(status)}</span>
      </div>

      <div class="text-center text-xs text-gray-400 mb-4">
        ${escapeHTML(formatKickoff(match.kickoffAt))}
      </div>

      <form class="prediction-form">
        <input type="hidden" name="fixtureId" value="${escapeHTML(match.fixtureId)}">
        <input type="hidden" name="date" value="${escapeHTML(match.date)}">

        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div class="flex flex-col items-center text-center gap-2 min-w-0">
            ${teamLogo(match.home)}
            <span class="text-sm font-bold break-words">${escapeHTML(match.home.name)}</span>
            ${match.goals.home !== null
              ? `<span class="text-xs text-gray-400">Score: ${match.goals.home}</span>`
              : ""}
          </div>

          <div class="flex flex-col gap-2 min-w-0">
            <label class="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-bold hover:border-green-400">
              <input type="radio" name="outcome" value="home"
                class="mr-1 accent-green-500"
                ${selectedOutcome === "home" ? "checked" : ""}
                ${locked ? "disabled" : ""} required>
              Home Win
            </label>
            <label class="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-bold hover:border-green-400">
              <input type="radio" name="outcome" value="draw"
                class="mr-1 accent-green-500"
                ${selectedOutcome === "draw" ? "checked" : ""}
                ${locked ? "disabled" : ""} required>
              Draw
            </label>
            <label class="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-bold hover:border-green-400">
              <input type="radio" name="outcome" value="away"
                class="mr-1 accent-green-500"
                ${selectedOutcome === "away" ? "checked" : ""}
                ${locked ? "disabled" : ""} required>
              Away Win
            </label>
          </div>

          <div class="flex flex-col items-center text-center gap-2 min-w-0">
            ${teamLogo(match.away)}
            <span class="text-sm font-bold break-words">${escapeHTML(match.away.name)}</span>
            ${match.goals.away !== null
              ? `<span class="text-xs text-gray-400">Score: ${match.goals.away}</span>`
              : ""}
          </div>
        </div>

        <div class="mt-5">
          <button type="submit" class="primary-btn w-full rounded-xl py-3 text-sm"
            ${locked || !currentUser ? "disabled" : ""}>
            <i class="fa-solid fa-floppy-disk mr-2"></i>
            ${saved ? "Update prediction" : "Save prediction"}
          </button>
        </div>
        ${!currentUser
          ? `<p class="text-xs text-yellow-300 mt-3 text-center">Sign in to save your prediction.</p>`
          : ""}
      </form>
    </article>
  `;
}

async function loadMyPredictions() {
  if (!currentUser) {
    savedPredictions = {};
    document.getElementById("myPoints").textContent = "—";
    document.getElementById("myPredictionCount").textContent = "—";
    document.getElementById("myRank").textContent = "—";
    return;
  }

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(`${API}/api/predictions/mine`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok || !data.success) throw new Error(data.message || "Unable to load predictions");

    savedPredictions = {};
    for (const prediction of data.predictions || []) {
      savedPredictions[prediction.fixtureId] = prediction;
    }

    const predictions = data.predictions || [];
    const points = predictions.reduce((sum, item) => sum + (Number(item.points) || 0), 0);

    document.getElementById("myPoints").textContent = points;
    document.getElementById("myPredictionCount").textContent = predictions.length;
    document.getElementById("myRank").textContent = "—";
  } catch (error) {
    console.error("My predictions:", error);
    showNotice("Could not load your saved predictions.", true);
  }
}

async function loadMatches() {
  const date = dateInput.value;
  if (!date) return;

  loadedDate = date;
  matchesList.innerHTML = `
    <div class="glass rounded-2xl p-6 text-center text-gray-400">
      <i class="fa-solid fa-spinner fa-spin text-2xl green"></i>
      <p class="mt-3">Loading matches…</p>
    </div>`;

  showNotice("Loading matches…");

  try {
    const response = await fetch(`${API}/api/predictions/matches?date=${encodeURIComponent(date)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load matches");
    }

    if (loadedDate !== dateInput.value) return;

    const matches = data.matches || [];

    if (!matches.length) {
      matchesList.innerHTML = `
        <div class="glass rounded-2xl p-8 text-center">
          <i class="fa-regular fa-calendar-xmark text-3xl green"></i>
          <p class="font-bold mt-3">No matches found</p>
          <p class="text-sm text-gray-400 mt-1">Choose another date.</p>
        </div>`;
      showNotice("No matches found for this date.");
      return;
    }

    matchesList.innerHTML = matches.map(renderMatch).join("");
    showNotice(`${matches.length} matches found. Predictions lock at kickoff.`);
  } catch (error) {
    console.error("Load matches:", error);
    matchesList.innerHTML = `
      <div class="glass rounded-2xl p-6 text-center">
        <p class="text-red-400 font-bold">Unable to load matches</p>
        <p class="text-sm text-gray-400 mt-2">The server may be starting. Please try again.</p>
        <button id="retryMatches" class="primary-btn rounded-xl px-4 py-2 mt-4">Retry</button>
      </div>`;
    showNotice("Could not connect to the match service.", true);
  }
}

matchesList.addEventListener("submit", async event => {
  if (!event.target.matches(".prediction-form")) return;
  event.preventDefault();

  if (!currentUser) {
    showNotice("Please sign in before saving a prediction.", true);
    return;
  }

  const form = event.target;
  const fixtureId = form.elements.fixtureId.value;
  const date = form.elements.date.value;
  const outcome = form.querySelector('input[name="outcome"]:checked')?.value;
  const button = form.querySelector('button[type="submit"]');

  if (!["home", "draw", "away"].includes(outcome)) {
    showNotice("Choose Home Win, Draw, or Away Win.", true);
    return;
  }

  button.disabled = true;
  button.textContent = "Saving…";

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(`${API}/api/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fixtureId, date, outcome })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to save prediction");
    }

    showNotice("Prediction saved successfully!");
    await loadMyPredictions();
    await loadMatches();
  } catch (error) {
    showNotice(error.message || "Unable to save prediction.", true);
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i>Save prediction';
  }
});

matchesList.addEventListener("click", event => {
  if (event.target.closest("#retryMatches")) loadMatches();
});


async function loadLeaderboard() {
  if (!leaderboardList || !leaderboardNotice) return;

  leaderboardNotice.textContent = "Loading leaderboard…";
  leaderboardList.innerHTML =
    '<tr><td colspan="4" class="p-3 text-gray-400">Loading players…</td></tr>';

  try {
    const response = await fetch(`${API}/api/predictions/leaderboard`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load leaderboard");
    }

    const players = data.leaderboard || [];

    if (!players.length) {
      leaderboardNotice.textContent = "No scored predictions yet.";
      leaderboardList.innerHTML =
        '<tr><td colspan="4" class="p-3 text-gray-400">The leaderboard will appear when predictions are scored.</td></tr>';
      document.getElementById("myRank").textContent = "—";
      return;
    }

    leaderboardNotice.textContent =
      `${players.length} player${players.length === 1 ? "" : "s"} ranked`;

    leaderboardList.innerHTML = players.map((player, index) => {
      const rank = Number(player.rank) || index + 1;
      const name = escapeHTML(player.name || "VibeSport Player");
      const points = Number(player.points) || 0;
      const predictions = Number(player.predictions) || 0;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

      return `
        <tr class="border-b border-white/5 hover:bg-white/5">
          <td class="p-3 font-bold green">${medal}</td>
          <td class="p-3 font-semibold">${name}</td>
          <td class="p-3 text-center">${predictions}</td>
          <td class="p-3 text-right font-black">${points}</td>
        </tr>
      `;
    }).join("");

    const myEntry = currentUser
      ? players.find(player => player.userId === currentUser.uid)
      : null;

    document.getElementById("myRank").textContent = myEntry
      ? (Number(myEntry.rank) || players.indexOf(myEntry) + 1)
      : "—";
  } catch (error) {
    console.error("Leaderboard:", error);
    leaderboardNotice.textContent = "Could not load leaderboard.";
    leaderboardList.innerHTML =
      '<tr><td colspan="4" class="p-3 text-red-400">Leaderboard could not be loaded. Please try again.</td></tr>';
  }
}

if (leaderboardRefresh) leaderboardRefresh.addEventListener("click", loadLeaderboard);

dateInput.value = localDateString();
dateInput.addEventListener("change", loadMatches);

document.getElementById("refreshFixtures").addEventListener("click", async () => {
  await loadMyPredictions();
  await loadMatches();
  await loadLeaderboard();
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  await loadMyPredictions();
  await loadMatches();
  await loadLeaderboard();
});

const API_BASE = "https://footballxtra-website.onrender.com";

const container = document.getElementById("homeLiveScores");

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function teamLogo(url, name) {
  if (url) {
    return `
      <img
        src="${escapeHTML(url)}"
        alt="${escapeHTML(name)}"
        class="w-12 h-12 object-contain mx-auto"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      >
      <div class="hidden w-12 h-12 rounded-full bg-white/10 mx-auto items-center justify-center text-xl">
        ⚽
      </div>
    `;
  }

  return `
    <div class="w-12 h-12 rounded-full bg-white/10 mx-auto flex items-center justify-center text-xl">
      ⚽
    </div>
  `;
}

function renderMatch(match) {
  const home = match.home || match.teams?.home || {};
  const away = match.away || match.teams?.away || {};
  const league = match.league || {};
  const status = match.status || match.fixture?.status || {};

  const homeScore = home.score ?? match.goals?.home;
  const awayScore = away.score ?? match.goals?.away;

  const short = status.short || "";
  const isLive = ["1H", "2H", "HT", "ET", "P", "LIVE", "BT"].includes(short);
  const isFinished = ["FT", "AET", "PEN"].includes(short);
  const espnState = status.state || "";
  const effectiveLive = isLive || espnState === "in";
  const effectiveFinished = isFinished || espnState === "post";

  let statusText = "UPCOMING";
  let statusClass = "text-green-400";

  if (effectiveLive) {
    statusText = `● LIVE${status.elapsed != null ? ` ${status.elapsed}'` : ""}`;
    statusClass = "text-red-400";
  } else if (effectiveFinished) {
    statusText = "FT";
    statusClass = "text-gray-400";
  } else if (match.fixture?.date) {
    const time = new Date(match.fixture.date).toLocaleTimeString("en-US", {
      timeZone: "Africa/Addis_Ababa",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    statusText = time;
  }

  const score =
    homeScore != null && awayScore != null
      ? `${homeScore} - ${awayScore}`
      : "VS";

  return `
    <article class="glass rounded-2xl p-5 border border-white/10 hover:border-green-400/30 transition">

      <div class="flex justify-between items-center gap-3 text-xs mb-5">
        <div class="min-w-0">
          <p class="font-bold text-gray-300 truncate">
            ${escapeHTML(league.name || "Football")}
          </p>
          <p class="text-gray-500 truncate">
            ${escapeHTML(league.country || "")}
          </p>
        </div>

        <span class="${statusClass} font-black whitespace-nowrap">
          ${escapeHTML(statusText)}
        </span>
      </div>

      <div class="flex items-center justify-between gap-3">

        <div class="text-center flex-1 min-w-0">
          ${teamLogo(home.logo, home.name)}
          <p class="text-xs font-bold mt-2 truncate">
            ${escapeHTML(home.name || "Home")}
          </p>
        </div>

        <div class="text-center shrink-0">
          <div class="text-2xl font-black">
            ${escapeHTML(score)}
          </div>
          <div class="text-[10px] ${statusClass} font-bold mt-1">
            ${escapeHTML(short || (effectiveLive ? "LIVE" : "MATCH"))}
          </div>
        </div>

        <div class="text-center flex-1 min-w-0">
          ${teamLogo(away.logo, away.name)}
          <p class="text-xs font-bold mt-2 truncate">
            ${escapeHTML(away.name || "Away")}
          </p>
        </div>

      </div>
    </article>
  `;
}
async function loadHomeLiveScores() {
  if (!container) return;

  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Africa/Addis_Ababa"
    });

    const response = await fetch(
      `${API_BASE}/api/matches/today-espn?date=${today}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`ESPN HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.matches)) {
      throw new Error("Invalid ESPN API response");
    }

    const matches = data.matches;

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="md:col-span-3 glass rounded-2xl p-8 text-center">
          <div class="text-4xl mb-3">⚽</div>
          <p class="font-bold text-gray-300">
            No matches scheduled today
          </p>
          <p class="text-xs text-gray-500 mt-1">
            Check back later for upcoming football matches.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = matches
      .slice(0, 6)
      .map(renderMatch)
      .join("");

  } catch (error) {
    console.error("Home Live Scores Error:", error);

    container.innerHTML = `
      <div class="md:col-span-3 glass rounded-2xl p-6 text-center">
        <i class="fa-solid fa-circle-exclamation text-red-400 text-2xl mb-3"></i>
        <p class="font-bold text-gray-300">
          Live scores unavailable
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Please try again shortly.
        </p>
      </div>
    `;
  }
}

loadHomeLiveScores();

// Refresh every 60 seconds
setInterval(loadHomeLiveScores, 60000);

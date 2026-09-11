const STANDINGS_API = "http://localhost:3000/api/standings/premier-league";

async function loadHomeStandings() {
  const table = document.getElementById("homeLeagueTable");

  if (!table) {
    console.warn("⚠️ Home league table not found");
    return;
  }

  try {
    const response = await fetch(STANDINGS_API, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!data.success || !Array.isArray(data.standings)) {
      throw new Error(data.message || "Invalid standings response");
    }

    const header = table.querySelector(".grid.grid-cols-12");

    table.innerHTML = "";

    if (header) {
      table.appendChild(header);
    }

    data.standings.slice(0, 3).forEach((item, index) => {
      const row = document.createElement("div");

      row.className =
        "grid grid-cols-12 px-4 py-4 border-b border-white/5 items-center";

      const gd =
        item.goalDifference > 0
          ? `+${item.goalDifference}`
          : `${item.goalDifference}`;

      row.innerHTML = `
        <span class="col-span-1 text-green-400 font-black">
          ${item.rank || index + 1}
        </span>

        <span class="col-span-6 font-semibold flex items-center gap-2">
          ${
            item.team?.logo
              ? `<img src="${item.team.logo}" alt="" class="w-6 h-6 object-contain">`
              : ""
          }
          ${item.team?.name || "Unknown"}
        </span>

        <span class="col-span-2 text-center text-gray-400">
          ${item.played ?? 0}
        </span>

        <span class="col-span-1 text-center text-gray-400">
          ${gd}
        </span>

        <span class="col-span-2 text-center font-black">
          ${item.points ?? 0}
        </span>
      `;

      table.appendChild(row);
    });

    console.log("✅ Premier League table updated");

  } catch (error) {
    console.error("❌ Home standings error:", error);
  }
}

loadHomeStandings();

setInterval(loadHomeStandings, 60000);

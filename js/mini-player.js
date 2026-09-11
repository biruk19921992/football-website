(function () {
  const STORAGE_KEY = "footballxtraMiniPlayer";

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveState(youtubeId, title = "Football Video") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ youtubeId, title, playing: true })
    );
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function renderPlayer(state) {
    if (!state?.youtubeId) return;

    const old = document.getElementById("footballxtra-mini-player");
    if (old) old.remove();

    const player = document.createElement("div");
    player.id = "footballxtra-mini-player";
    player.className =
      "fixed bottom-4 right-4 z-[99999] w-[300px] max-w-[calc(100vw-20px)] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20";

    player.innerHTML = `
      <div class="flex items-center justify-between px-3 py-2 bg-gray-900 text-white">
        <span class="text-xs font-bold truncate pr-2">🎬 ${state.title || "Football Video"}</span>
        <button type="button" id="close-footballxtra-video"
          class="text-xl leading-none px-2 text-gray-300 hover:text-white">×</button>
      </div>
      <div class="aspect-video">
        <iframe
          class="w-full h-full"
          src="https://www.youtube.com/embed/${encodeURIComponent(state.youtubeId)}?autoplay=1&rel=0"
          title="${state.title || "Football Video"}"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    `;

    document.body.appendChild(player);

    document
      .getElementById("close-footballxtra-video")
      ?.addEventListener("click", () => {
        clearState();
        player.remove();
      });
  }

  window.FootballXtraMiniPlayer = {
    play(youtubeId, title) {
      if (!youtubeId) return;
      saveState(youtubeId, title);
      renderPlayer({ youtubeId, title });
    },
    close() {
      clearState();
      document.getElementById("footballxtra-mini-player")?.remove();
    }
  };

  const state = getState();
  if (state?.youtubeId && state.playing) {
    renderPlayer(state);
  }
})();

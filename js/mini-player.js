(function () {
  const STORAGE_KEY = "footballxtraMiniPlayer";
  let player = null;
  let saveTimer = null;

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveState(youtubeId, title = "Football Video", currentTime = 0) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        youtubeId,
        title,
        currentTime: Number(currentTime) || 0,
        playing: true
      })
    );
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }
  }

  function renderPlayer(state) {
    if (!state?.youtubeId) return;

    document.getElementById("footballxtra-mini-player")?.remove();

    const container = document.createElement("div");
    container.id = "footballxtra-mini-player";
    container.className =
      "fixed bottom-3 right-3 z-[99999] w-[300px] max-w-[calc(100vw-24px)] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/15 transition-all duration-300";

    container.innerHTML = `
      <div id="footballxtra-mini-header"
        class="flex items-center gap-2 px-3 py-2.5 bg-gray-900/95 text-white border-b border-white/10">

        <div class="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
          <span class="text-sm">🎬</span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-[10px] uppercase tracking-wider text-green-400 font-bold">
            VibeSport
          </div>
          <div id="footballxtra-mini-title"
            class="text-xs font-bold truncate">
            ${state.title || "Football Video"}
          </div>
        </div>

        <button type="button" id="minimize-footballxtra-video"
          aria-label="Minimize video"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10">
          −
        </button>

        <button type="button" id="close-footballxtra-video"
          aria-label="Close video"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-500/10 text-lg">
          ×
        </button>
      </div>

      <div id="footballxtra-mini-video-wrap" class="aspect-video bg-black">
        <div id="footballxtra-youtube-player"></div>
      </div>

      <div class="relative h-1 bg-white/10">
        <div id="footballxtra-mini-progress"
          class="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
          style="width:0%">
        </div>
      </div>

      <div id="footballxtra-mini-controls"
        class="flex items-center justify-between px-3 py-2 bg-gray-900/95 border-t border-white/10">
        <span class="text-[10px] text-gray-400 truncate pr-2">
          ▶ Playing on VibeSport
        </span>
        <span id="footballxtra-mini-time"
          class="text-[10px] text-gray-500 shrink-0">
          0:00
        </span>
      </div>
    `;

    document.body.appendChild(container);

    // Keep YouTube video perfectly sized at 16:9 without cropping/stretching
    const style = document.createElement("style");
    style.id = "footballxtra-mini-video-style";
    style.textContent = `
      #footballxtra-mini-player #footballxtra-mini-video-wrap {
        position: relative;
        width: 100%;
        background: #000;
        overflow: hidden;
      }

      #footballxtra-mini-player #footballxtra-youtube-player,
      #footballxtra-mini-player #footballxtra-youtube-player iframe {
        width: 100% !important;
        height: auto !important;
        min-height: 170px;
        aspect-ratio: auto;
        display: block;
        border: 0;
      }
    `;

    document.head.appendChild(style);

    let minimized = false;

    const videoWrap = document.getElementById("footballxtra-mini-video-wrap");
    const minimizeBtn = document.getElementById("minimize-footballxtra-video");

    minimizeBtn?.addEventListener("click", () => {
      minimized = !minimized;

      if (minimized) {
        videoWrap?.classList.add("hidden");

        container.classList.remove("w-[300px]");
        container.classList.add("w-[220px]");

        minimizeBtn.textContent = "⬆";
        minimizeBtn.setAttribute("aria-label", "Maximize video");
      } else {
        videoWrap?.classList.remove("hidden");

        container.classList.remove("w-[220px]");
        container.classList.add("w-[300px]");

        minimizeBtn.textContent = "−";
        minimizeBtn.setAttribute("aria-label", "Minimize video");
      }
    });

    // ===== DRAGGABLE MINI PLAYER =====
    const header = document.getElementById("footballxtra-mini-header");

    if (header) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      header.style.cursor = "grab";
      header.style.touchAction = "none";

      header.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;

        const rect = container.getBoundingClientRect();

        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.right = "auto";
        container.style.bottom = "auto";

        header.style.cursor = "grabbing";
        header.setPointerCapture?.(event.pointerId);
      });

      header.addEventListener("pointermove", (event) => {
        if (!dragging) return;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        const maxLeft = window.innerWidth - container.offsetWidth - 8;
        const maxTop = window.innerHeight - container.offsetHeight - 8;

        const left = Math.max(8, Math.min(startLeft + dx, maxLeft));
        const top = Math.max(8, Math.min(startTop + dy, maxTop));

        container.style.left = `${left}px`;
        container.style.top = `${top}px`;
      });

      const stopDragging = (event) => {
        if (!dragging) return;

        dragging = false;
        header.style.cursor = "grab";
        header.releasePointerCapture?.(event.pointerId);
      };

      header.addEventListener("pointerup", stopDragging);
      header.addEventListener("pointercancel", stopDragging);
    }

    document
      .getElementById("close-footballxtra-video")
      ?.addEventListener("click", () => {
        clearState();
        player?.destroy?.();
        player = null;
        container.remove();
      });

    function createYouTubePlayer() {
      if (!window.YT?.Player) return;

      player = new YT.Player("footballxtra-youtube-player", {
        videoId: state.youtubeId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(Number(state.currentTime) || 0),
          rel: 0,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            const startTime = Math.floor(Number(state.currentTime) || 0);

            if (startTime > 0) {
              event.target.seekTo(startTime, true);
            }

            saveTimer = setInterval(() => {
              try {
                if (
                  player &&
                  typeof player.getCurrentTime === "function" &&
                  player.getPlayerState?.() === YT.PlayerState.PLAYING
                ) {
                  const current = player.getCurrentTime();
                  const duration =
                    typeof player.getDuration === "function"
                      ? player.getDuration()
                      : 0;

                  saveState(
                    state.youtubeId,
                    state.title,
                    current
                  );

                  const progress =
                    document.getElementById("footballxtra-mini-progress");

                  const timeLabel =
                    document.getElementById("footballxtra-mini-time");

                  if (progress && duration > 0) {
                    const percent = Math.min(
                      100,
                      Math.max(0, (current / duration) * 100)
                    );

                    progress.style.width = `${percent}%`;
                  }

                  if (timeLabel) {
                    const mins = Math.floor(current / 60);
                    const secs = Math.floor(current % 60)
                      .toString()
                      .padStart(2, "0");

                    timeLabel.textContent = `${mins}:${secs}`;
                  }
                }
              } catch {}
            }, 1000);
          },

          onStateChange: (event) => {
            try {
              if (
                event.data === YT.PlayerState.PAUSED ||
                event.data === YT.PlayerState.ENDED
              ) {
                const currentTime =
                  typeof event.target.getCurrentTime === "function"
                    ? event.target.getCurrentTime()
                    : Number(state.currentTime) || 0;

                saveState(
                  state.youtubeId,
                  state.title,
                  currentTime
                );
              }
            } catch {}
          }
        }
      });
    }

    if (window.YT?.Player) {
      createYouTubePlayer();
    } else {
      window.onYouTubeIframeAPIReady = createYouTubePlayer;

      if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }
  }

  window.FootballXtraMiniPlayer = {
    play(youtubeId, title) {
      if (!youtubeId) return;

      clearState();
      saveState(youtubeId, title, 0);
      renderPlayer({
        youtubeId,
        title,
        currentTime: 0,
        playing: true
      });
    },

    close() {
      clearState();
      player?.destroy?.();
      player = null;
      document.getElementById("footballxtra-mini-player")?.remove();
    }
  };

  const state = getState();

  if (state?.youtubeId && state.playing) {
    renderPlayer(state);
  }
})();

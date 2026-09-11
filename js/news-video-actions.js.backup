document.addEventListener("DOMContentLoaded", () => {
  function actions(type, id) {
    return `
      <div class="grid grid-cols-4 border-t border-white/10 mt-4">
        <button type="button" class="nv-action py-3 text-gray-400 hover:text-red-400 transition" data-action="like" data-id="${id}">
          <i class="fa-regular fa-heart"></i>
          <span class="ml-1 text-xs">Like</span>
        </button>

        <button type="button" class="nv-action py-3 text-gray-400 hover:text-blue-400 transition" data-action="comment" data-id="${id}">
          <i class="fa-regular fa-comment"></i>
          <span class="ml-1 text-xs">Comment</span>
        </button>

        <button type="button" class="nv-action py-3 text-gray-400 hover:text-green-400 transition" data-action="repost" data-id="${id}">
          <i class="fa-solid fa-retweet"></i>
          <span class="ml-1 text-xs">Repost</span>
        </button>

        <button type="button" class="nv-action py-3 text-gray-400 hover:text-purple-400 transition" data-action="share" data-id="${id}">
          <i class="fa-solid fa-share"></i>
          <span class="ml-1 text-xs">Share</span>
        </button>
      </div>
    `;
  }

  function addActions(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const observer = new MutationObserver(() => {
      container.querySelectorAll(":scope > div").forEach((card, index) => {
        if (card.querySelector(".nv-action")) return;

        const id = `${type}-${index + 1}`;
        card.insertAdjacentHTML("beforeend", actions(type, id));
      });
    });

    observer.observe(container, { childList: true, subtree: true });

    container.querySelectorAll(":scope > div").forEach((card, index) => {
      if (!card.querySelector(".nv-action")) {
        card.insertAdjacentHTML("beforeend", actions(type, `${type}-${index + 1}`));
      }
    });
  }

  addActions("homeLatestNews", "news");
  addActions("homeLatestVideos", "video");

  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".nv-action");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "like") {
      button.classList.toggle("text-red-400");
      const icon = button.querySelector("i");
      icon.classList.toggle("fa-regular");
      icon.classList.toggle("fa-solid");
      return;
    }

    if (action === "comment") {
      alert("Comment feature coming soon 💬");
      return;
    }

    if (action === "repost") {
      alert("Reposted 🔁");
      return;
    }

    if (action === "share") {
      const url = `${window.location.origin}/index.html#${id}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "FootballXtra",
            text: "Check this football post ⚽",
            url
          });
        } catch (e) {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          alert("Link copied! 🔗");
        } catch (e) {
          alert(url);
        }
      }
    }
  });
});

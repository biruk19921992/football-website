import { db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const adsRef = collection(db, "advertisements");

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value = "") {
  try {
    const url = new URL(String(value), location.href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentlyActive(ad) {
  if (ad.active !== true) return false;

  const now = new Date();
  const start = toDate(ad.startAt);
  const end = toDate(ad.endAt);

  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
}

function renderMedia(ad, sidebar = false) {
  const data = ad.data;
  const mediaUrl = escapeHTML(safeUrl(data.mediaUrl));
  const title = escapeHTML(data.title || "Advertisement");
  const type = String(data.type || "image").toLowerCase();
  // Preserve the original aspect ratio; limit height without cropping.
  const size = sidebar
    ? "block w-full h-auto max-h-[360px] object-contain"
    : "block w-full h-auto max-h-[420px] object-contain";

  if (!mediaUrl) {
    return `<div class="p-5 text-center text-sm text-gray-400">Ad media URL is missing.</div>`;
  }

  if (type === "video" || type === "mp4") {
    return `
      <video
        class="${size}"
        autoplay muted loop playsinline
        preload="metadata"
        aria-label="${title}">
        <source src="${mediaUrl}" type="video/mp4">
      </video>
    `;
  }

  // GIF is displayed as an image; animated GIFs play automatically.
  return `
    <img
      src="${mediaUrl}"
      alt="${title}"
      class="${size}"
      loading="lazy">
  `;
}

function renderAd(ad, sidebar = false) {
  const data = ad.data;
  const title = escapeHTML(data.title || "Advertisement");
  const advertiser = escapeHTML(data.advertiser || "");
  const clickUrl = safeUrl(data.clickUrl);
  const media = renderMedia(ad, sidebar);

  const card = `
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div class="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
        <span class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
          Advertisement
        </span>
        ${advertiser ? `<span class="text-[10px] text-gray-500 truncate">${advertiser}</span>` : ""}
      </div>
      <div class="relative">
        ${media}
        <div class="absolute bottom-2 left-2 bg-black/75 px-2 py-1 rounded text-[10px] text-white">
          ${title}
        </div>
      </div>
    </div>
  `;

  return clickUrl
    ? `<a href="${escapeHTML(clickUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${title}">${card}</a>`
    : card;
}

function setupSidebarAds(allAds) {
  const sidebarAds = allAds
    .filter(ad =>
      isCurrentlyActive(ad.data) &&
      ad.data.placement === "sidebar"
    )
    .sort((a, b) =>
      Number(b.data.priority || 0) - Number(a.data.priority || 0)
    );

  if (!sidebarAds.length) return;

  const style = document.createElement("style");
  style.textContent = `
    #vibeSidebarAds {
      position: fixed;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 190px;
      z-index: 40;
      background: #0b1220;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 16px;
      padding: 10px;
      box-shadow: 0 12px 35px rgba(0,0,0,.3);
    }
    #vibeSidebarAds .sidebar-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      padding-top: 8px;
    }
    #vibeSidebarAds button {
      color: #d1d5db;
      background: rgba(255,255,255,.08);
      border-radius: 8px;
      padding: 4px 9px;
    }
    #vibeSidebarAds .sidebar-dots {
      color: #9ca3af;
      font-size: 11px;
    }
    @media (max-width: 1100px) {
      #vibeSidebarAds {
        position: relative;
        top: auto;
        right: auto;
        transform: none;
        width: 100%;
        max-width: 420px;
        margin: 0 auto 24px;
      }
    }
  `;
  document.head.appendChild(style);

  const rail = document.createElement("aside");
  rail.id = "vibeSidebarAds";
  rail.setAttribute("aria-label", "Rotating advertisements");
  rail.innerHTML = `
    <div id="vibeSidebarCurrent"></div>
    <div class="sidebar-controls">
      <button type="button" id="vibeAdPrev" aria-label="Previous ad">‹</button>
      <span id="vibeAdDots" class="sidebar-dots"></span>
      <button type="button" id="vibeAdNext" aria-label="Next ad">›</button>
    </div>
  `;

  // Put the ad rail inside the page content on narrow screens.
  const main = document.querySelector("main");
  if (main) {
    main.prepend(rail);
  } else {
    document.body.appendChild(rail);
  }

  const current = rail.querySelector("#vibeSidebarCurrent");
  const dots = rail.querySelector("#vibeAdDots");
  let index = 0;
  let timer;

  function showAd(nextIndex) {
    index = (nextIndex + sidebarAds.length) % sidebarAds.length;
    current.innerHTML = renderAd(sidebarAds[index], true);
    dots.textContent = `${index + 1} / ${sidebarAds.length}`;
  }

  function restartTimer() {
    clearInterval(timer);
    if (sidebarAds.length > 1) {
      timer = setInterval(() => showAd(index + 1), 6000);
    }
  }

  rail.querySelector("#vibeAdPrev").addEventListener("click", () => {
    showAd(index - 1);
    restartTimer();
  });

  rail.querySelector("#vibeAdNext").addEventListener("click", () => {
    showAd(index + 1);
    restartTimer();
  });

  showAd(0);
  restartTimer();
}

function ensureAdSlot(id, className = "my-8 w-full") {
  let slot = document.getElementById(id);
  if (slot) return slot;

  slot = document.createElement("section");
  slot.id = id;
  slot.className = `${className} hidden`;
  slot.setAttribute("aria-label", "Advertisements");

  document.querySelector("main")?.appendChild(slot);
  return slot;
}

function prepareAdSlots(pageName) {
  const main = document.querySelector("main");
  if (!main) return;

  if (pageName === "index.html") {
    const top = document.getElementById("homeAds");
    const live = document.getElementById("homeLiveScores");
    if (top && live) {
      const section = live.closest("section");
      if (section && section.parentElement === main) {
        main.insertBefore(top, section);
      }
    }

    const middle = ensureAdSlot("homeAdsMiddle");
    ensureAdSlot("homeAdsBottom");

    const feed = document.getElementById("homeSocialFeed");
    const feedSection = feed?.closest("section");
    if (feedSection) feedSection.insertAdjacentElement("afterend", middle);
  }

  if (pageName === "news.html") {
    const middle = ensureAdSlot(
      "newsAdsMiddle",
      "col-span-full w-full my-4"
    );
    ensureAdSlot("newsAdsBottom");

    const list = document.getElementById("newsList");
    if (list) {
      const placeMiddle = () => {
        const cards = [...list.children].filter(el =>
          el.classList.contains("news-card")
        );
        if (!cards.length) return;

        const anchor = cards[Math.min(3, cards.length - 1)];
        if (anchor.nextElementSibling !== middle) {
          anchor.insertAdjacentElement("afterend", middle);
        }
      };

      new MutationObserver(placeMiddle).observe(list, {
        childList: true
      });
      placeMiddle();
    }
  }

  if (pageName === "videos.html") {
    const middle = ensureAdSlot("videosAdsMiddle");
    ensureAdSlot("videosAdsBottom");

    const featured = document.getElementById("featuredVideo");
    if (featured) featured.insertAdjacentElement("afterend", middle);
  }

  const bottomId = {
    "index.html": "homeAdsBottom",
    "news.html": "newsAdsBottom",
    "videos.html": "videosAdsBottom"
  }[pageName];

  if (bottomId) {
    const bottom = document.getElementById(bottomId);
    if (bottom) main.appendChild(bottom);
  }
}

async function loadPageAds() {
  const pageName = location.pathname.split("/").pop() || "index.html";

  const pages = {
    "index.html": {
      placement: "homepage",
      slots: { top: "homeAds", middle: "homeAdsMiddle", bottom: "homeAdsBottom" }
    },
    "news.html": {
      placement: "news",
      slots: { top: "newsAds", middle: "newsAdsMiddle", bottom: "newsAdsBottom" }
    },
    "videos.html": {
      placement: "videos",
      slots: { top: "videosAds", middle: "videosAdsMiddle", bottom: "videosAdsBottom" }
    }
  };

  const page = pages[pageName];
  prepareAdSlots(page ? pageName : "");

  try {
    const snapshot = await getDocs(
      query(adsRef, orderBy("createdAt", "desc"))
    );

    const allAds = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    if (page) {
      const pageAds = allAds
        .filter(ad =>
          isCurrentlyActive(ad.data) &&
          [page.placement, "all", "homepage"].includes(ad.data.placement)
        )
        .sort((a, b) =>
          Number(b.data.priority || 0) - Number(a.data.priority || 0)
        );

      for (const [position, id] of Object.entries(page.slots)) {
        const slot = document.getElementById(id);
        if (!slot) continue;

        const ad = pageAds.find(item =>
          (item.data.position || "top") === position
        );

        slot.innerHTML = ad ? renderAd(ad) : "";
        slot.classList.toggle("hidden", !ad);
      }
    }

    setupSidebarAds(allAds);
    console.log("VibeSport ads loaded by position.");
  } catch (error) {
    console.error("Page ads error:", error);
  }
}

loadPageAds();

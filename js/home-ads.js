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

function renderAd(ad) {
  const data = ad.data;
  const mediaUrl = escapeHTML(data.mediaUrl || "");
  const clickUrl = escapeHTML(data.clickUrl || "");
  const title = escapeHTML(data.title || "Advertisement");
  const advertiser = escapeHTML(data.advertiser || "");

  let media = "";

  if (data.type === "video") {
    media = `
      <video
        class="w-full h-40 md:h-56 object-cover"
        autoplay
        muted
        loop
        playsinline
        preload="metadata">
        <source src="${mediaUrl}">
      </video>
    `;
  } else {
    media = `
      <img
        src="${mediaUrl}"
        alt="${title}"
        class="w-full h-40 md:h-56 object-cover"
        loading="lazy">
    `;
  }

  const content = `
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div class="px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <span class="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
          Advertisement
        </span>
        ${advertiser ? `<span class="text-[10px] text-gray-600">${advertiser}</span>` : ""}
      </div>
      <div class="relative">
        ${media}
        <div class="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded text-[10px] text-white">
          Advertisement
        </div>
      </div>
    </div>
  `;

  if (clickUrl) {
    return `
      <a href="${clickUrl}" target="_blank" rel="noopener noreferrer" aria-label="${title}">
        ${content}
      </a>
    `;
  }

  return content;
}

async function loadHomeAds() {
  const container = document.getElementById("homeAds");
  if (!container) return;

  try {
    const snapshot = await getDocs(
      query(adsRef, orderBy("createdAt", "desc"))
    );

    const ads = snapshot.docs
      .map(doc => ({
        id: doc.id,
        data: doc.data()
      }))
      .filter(ad =>
        isCurrentlyActive(ad.data) &&
        ["homepage", "all"].includes(ad.data.placement)
      )
      .sort((a, b) =>
        Number(b.data.priority || 0) - Number(a.data.priority || 0)
      )
      .slice(0, 2);

    if (!ads.length) {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    container.innerHTML = ads.map(renderAd).join("");

    console.log(`Homepage ads loaded: ${ads.length}`);
  } catch (error) {
    console.error("Homepage ads error:", error);
    container.innerHTML = "";
    container.classList.add("hidden");
  }
}

loadHomeAds();

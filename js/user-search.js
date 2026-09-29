import {
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

/* GLOBAL USER SEARCH */
const searchButton = document.getElementById("globalUserSearchBtn");

if (searchButton && !document.getElementById("globalUserSearchModal")) {

  const modal = document.createElement("div");

  modal.id = "globalUserSearchModal";

  modal.className =
    "fixed inset-0 z-[120] hidden bg-black/80 backdrop-blur-sm";

  modal.innerHTML = `
    <div class="min-h-full flex items-start justify-center p-4 pt-20 sm:pt-28">

      <div class="w-full max-w-lg bg-[#111]
                  border border-white/10 rounded-2xl
                  shadow-2xl overflow-hidden">

        <div class="flex items-center gap-3 p-4
                    border-b border-white/10">

          <div class="flex-1 relative">
            <i class="fa-solid fa-magnifying-glass
                      absolute left-4 top-1/2 -translate-y-1/2
                      text-gray-500"></i>

            <input
              id="globalUserSearchInput"
              type="search"
              placeholder="Search users..."
              autocomplete="off"
              class="w-full bg-white/5 border border-white/10
                     rounded-xl pl-11 pr-4 py-3
                     text-sm text-white
                     placeholder-gray-500 outline-none
                     focus:border-green-400/50"
            >
          </div>

          <button
            id="globalUserSearchClose"
            type="button"
            class="w-10 h-10 rounded-xl bg-white/5
                   text-gray-400 hover:text-white shrink-0">
            <i class="fa-solid fa-xmark"></i>
          </button>

        </div>

        <div
          id="globalUserSearchResults"
          class="p-3 max-h-[65vh] overflow-y-auto space-y-2">
        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const input =
    document.getElementById("globalUserSearchInput");

  const results =
    document.getElementById("globalUserSearchResults");

  const closeButton =
    document.getElementById("globalUserSearchClose");

  let timer = null;

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function searchUsers(value) {

    const text = value.trim();

    if (!text) {
      results.innerHTML = `
        <div class="text-center py-10 text-gray-500 text-sm">
          <i class="fa-solid fa-user-group text-xl mb-3"></i>
          <p class="font-bold text-gray-300">
            Search all users
          </p>
          <p class="text-xs mt-1">
            Enter a name to find a profile.
          </p>
        </div>
      `;
      return;
    }

    results.innerHTML = `
      <div class="text-center py-6 text-gray-500 text-sm">
        <i class="fa-solid fa-spinner fa-spin mr-2"></i>
        Searching users...
      </div>
    `;

    try {

      const usersQuery = query(
        collection(db, "users"),
        orderBy("name"),
        startAt(text),
        endAt(text + "\uf8ff"),
        limit(15)
      );

      const snapshot = await getDocs(usersQuery);

      if (snapshot.empty) {
        results.innerHTML = `
          <div class="text-center py-8 text-gray-500 text-sm">
            <i class="fa-solid fa-user-slash text-xl mb-2"></i>
            <p class="font-bold text-gray-300">
              No users found
            </p>
            <p class="text-xs mt-1">
              Try another name.
            </p>
          </div>
        `;
        return;
      }

      results.innerHTML = "";

      snapshot.forEach((userDoc) => {

        const data = userDoc.data();
        const uid = userDoc.id;

        const name =
          data.name ||
          data.displayName ||
          "FootballXtra User";

        const photo =
          data.photoURL || "";

        const followers =
          Number(data.followersCount || 0);

        const verified =
          data.role &&
          data.role !== "user";

        const row =
          document.createElement("a");

        row.href =
          `profile.html?uid=${encodeURIComponent(uid)}`;

        row.className =
          "flex items-center gap-3 p-3 rounded-xl " +
          "bg-white/5 hover:bg-white/10 transition";

        row.innerHTML = `
          <div class="w-11 h-11 rounded-full overflow-hidden
                      bg-white/10 shrink-0
                      flex items-center justify-center">

            ${
              photo
                ? `<img
                     src="${escapeHTML(photo)}"
                     class="w-full h-full object-cover"
                     alt="">`
                : `<i class="fa-solid fa-user text-gray-500"></i>`
            }

          </div>

          <div class="min-w-0 flex-1">

            <div class="flex items-center gap-1">

              <p class="font-bold text-white truncate">
                ${escapeHTML(name)}
              </p>

              ${
                verified
                  ? `<i class="fa-solid fa-circle-check
                              text-blue-400 text-xs"></i>`
                  : ""
              }

            </div>

            <p class="text-xs text-gray-500">
              ${followers.toLocaleString()} followers
            </p>

          </div>

          <i class="fa-solid fa-chevron-right
                    text-gray-600 text-xs"></i>
        `;

        results.appendChild(row);
      });

    } catch (error) {

      console.error(
        "Global user search error:",
        error
      );

      results.innerHTML = `
        <div class="text-center py-8 text-red-300 text-sm">
          Search failed. Please try again.
        </div>
      `;
    }
  }

  function openSearch() {

    modal.classList.remove("hidden");

    input.value = "";

    results.innerHTML = `
      <div class="text-center py-10 text-gray-500 text-sm">
        <i class="fa-solid fa-user-group text-xl mb-3"></i>
        <p class="font-bold text-gray-300">
          Search all users
        </p>
        <p class="text-xs mt-1">
          Enter a name to find a profile.
        </p>
      </div>
    `;

    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    modal.classList.add("hidden");
    input.value = "";
  }

  searchButton.addEventListener(
    "click",
    openSearch
  );

  closeButton.addEventListener(
    "click",
    closeSearch
  );

  modal.addEventListener("click", (event) => {

    if (event.target === modal) {
      closeSearch();
    }

  });

  input.addEventListener("input", () => {

    clearTimeout(timer);

    timer = setTimeout(() => {
      searchUsers(input.value);
    }, 350);

  });

  input.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {
      closeSearch();
    }

  });

}

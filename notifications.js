import { watchAuth } from "./js/auth.js";
import {
  ref,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { rtdb } from "./js/firebase.js";

const notificationBtn =
  document.getElementById("notificationBtn");

const notificationDropdown =
  document.getElementById("notificationDropdown");

const notificationList =
  document.getElementById("notificationList");

const markAllReadBtn =
  document.getElementById("markAllReadBtn");

let currentUser = null;
let currentNotifications = {};

function updateBadge(count) {
  if (!notificationBtn) return;

  let badge =
    notificationBtn.querySelector(".notification-badge");

  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className =
        "notification-badge absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center";
      notificationBtn.style.position = "relative";
      notificationBtn.appendChild(badge);
    }

    badge.textContent =
      count > 99 ? "99+" : String(count);
  } else if (badge) {
    badge.remove();
  }
}

function renderNotifications(data) {
  currentNotifications = data || {};

  if (!notificationList) return;

  const items = Object.entries(
    currentNotifications
  )
    .map(([id, notification]) => ({
      id,
      ...(notification || {})
    }))
    .sort(
      (a, b) =>
        Number(b.createdAt || b.timestamp || 0) -
        Number(a.createdAt || a.timestamp || 0)
    );

  if (items.length === 0) {
    notificationList.innerHTML = `
      <div class="px-6 py-12 text-center text-gray-400">
        <i class="fa-regular fa-bell-slash text-3xl mb-3"></i>
        <p class="text-sm">
          No notifications yet
        </p>
      </div>
    `;

    updateBadge(0);
    return;
  }

  const unreadCount =
    items.filter(
      (item) => item.read !== true
    ).length;

  updateBadge(unreadCount);

  notificationList.innerHTML =
    items
      .map((item) => {
        const title =
          item.title ||
          item.message ||
          "Football Xtra";

        const message =
          item.message ||
          item.description ||
          "";

        const time =
          item.createdAt ||
          item.timestamp;

        const dateText = time
          ? new Date(
              Number(time)
            ).toLocaleString()
          : "";

        const unread =
          item.read !== true;

        return `
          <div
            class="notification-item px-4 py-4 border-b border-white/10 cursor-pointer hover:bg-white/5 ${
              unread ? "bg-green-500/5" : ""
            }"
            data-notification-id="${item.id}">

            <div class="flex gap-3">

              <div class="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <i class="fa-regular fa-bell text-green-400"></i>
              </div>

              <div class="min-w-0 flex-1">

                <div class="flex items-start justify-between gap-2">
                  <h4 class="text-sm font-semibold text-white">
                    ${escapeHtml(title)}
                  </h4>

                  ${
                    unread
                      ? `<span class="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-1.5"></span>`
                      : ""
                  }
                </div>

                ${
                  message
                    ? `<p class="text-xs text-gray-400 mt-1">${escapeHtml(message)}</p>`
                    : ""
                }

                ${
                  dateText
                    ? `<p class="text-[10px] text-gray-500 mt-2">${escapeHtml(dateText)}</p>`
                    : ""
                }

              </div>
            </div>
          </div>
        `;
      })
      .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (notificationBtn && notificationDropdown) {
  notificationBtn.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      notificationDropdown.classList.toggle(
        "hidden"
      );
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        !notificationDropdown.contains(event.target) &&
        !notificationBtn.contains(event.target)
      ) {
        notificationDropdown.classList.add(
          "hidden"
        );
      }
    }
  );
}

if (notificationList) {
  notificationList.addEventListener(
    "click",
    async (event) => {
      const item =
        event.target.closest(
          ".notification-item"
        );

      if (!item || !currentUser) return;

      const id =
        item.dataset.notificationId;

      if (!id) return;

      const articleId = item.dataset.articleId || id;
      if (articleId && articleId !== "test1") {
        window.location.href = `article.html?id=${encodeURIComponent(articleId)}`;
        return;
      }

      try {
        await update(
          ref(
            rtdb,
            `notifications/${currentUser.uid}/${id}`
          ),
          {
            read: true
          }
        );
      } catch (error) {
        console.error(
          "Notification read error:",
          error
        );
      }
    }
  );
}

if (markAllReadBtn) {
  markAllReadBtn.addEventListener(
    "click",
    async () => {
      if (!currentUser) return;

      const updates = {};

      Object.keys(
        currentNotifications
      ).forEach((id) => {
        updates[
          `notifications/${currentUser.uid}/${id}/read`
        ] = true;
      });

      if (
        Object.keys(updates).length === 0
      ) {
        return;
      }

      try {
        await update(
          ref(rtdb),
          updates
        );
      } catch (error) {
        console.error(
          "Mark all read error:",
          error
        );
      }
    }
  );
}

watchAuth((user) => {
  currentUser = user;
  window.currentFirebaseUser = user;

  if (!user) {
    currentNotifications = {};

    if (notificationList) {
      notificationList.innerHTML = `
        <div class="px-6 py-12 text-center text-gray-400">
          <i class="fa-regular fa-bell-slash text-3xl mb-3"></i>
          <p class="text-sm">
            Login to see your notifications
          </p>
        </div>
      `;
    }

    updateBadge(0);
    return;
  }

  const notificationsRef =
    ref(
      rtdb,
      `notifications/${user.uid}`
    );

  onValue(
    notificationsRef,
    (snapshot) => {
      console.log(
        "🔔 RTDB notifications updated"
      );

      renderNotifications(
        snapshot.val()
      );
    },
    (error) => {
      console.error(
        "Realtime Database error:",
        error
      );
    }
  );
});

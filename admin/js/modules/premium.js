import { auth } from "../../../js/firebase.js";

const API_BASE = "https://footballxtra-website.onrender.com";

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const date = value._seconds
    ? new Date(value._seconds * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

async function apiRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("እባክዎ በAdmin መለያ ይግቡ።");

  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || `Request failed (${response.status})`);
  }
  return result;
}

export async function renderPremiumModule(container) {
  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xl font-black text-white">Premium Requests</h3>
          <p class="text-sm text-gray-400 mt-1">የክፍያ ማመልከቻዎችን ይመርምሩ።</p>
        </div>
        <button id="refreshPremiumRequests"
          class="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">
          <i class="fa-solid fa-rotate mr-2"></i>Refresh
        </button>
      </div>
      <div id="premiumRequestsMessage" class="text-sm text-gray-300"></div>
      <div id="premiumRequestsList" class="space-y-4">
        <div class="rounded-2xl border border-white/10 p-6 text-center text-gray-400">
          Loading requests...
        </div>
      </div>
    </div>
  `;

  const list = container.querySelector("#premiumRequestsList");
  const message = container.querySelector("#premiumRequestsMessage");
  const refreshButton = container.querySelector("#refreshPremiumRequests");

  async function loadRequests() {
    refreshButton.disabled = true;
    message.textContent = "ማመልከቻዎችን በመጫን ላይ...";
    list.innerHTML = `<div class="rounded-2xl border border-white/10 p-6 text-center text-gray-400">Loading...</div>`;

    try {
      const result = await apiRequest("/api/admin/premium/requests");
      const requests = Array.isArray(result.requests) ? result.requests : [];

      message.textContent = `${requests.length} request(s)`;

      if (!requests.length) {
        list.innerHTML = `<div class="rounded-2xl border border-white/10 p-8 text-center text-gray-400">ምንም የPremium ማመልከቻ የለም።</div>`;
        return;
      }

      list.innerHTML = requests.map(request => {
        const status = String(request.status || "pending").toLowerCase();
        const statusClass = status === "approved"
          ? "text-green-400"
          : status === "rejected"
            ? "text-red-400"
            : "text-yellow-300";

        const paymentNames = {
          telebirr: "Telebirr",
          cbe: "CBE",
          abyssinia: "Abyssinia Bank",
          apollo: "Apollo",
          abyssinia_fcy: "Abyssinia FCY Dollar"
        };

        return `
          <article class="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 space-y-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="font-bold text-white">${escapeHTML(request.email || request.uid || "Unknown user")}</div>
                <div class="text-xs text-gray-500 break-all">UID: ${escapeHTML(request.uid || "—")}</div>
              </div>
              <span class="font-black uppercase ${statusClass}">${escapeHTML(status)}</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div><div class="text-gray-500">Plan</div><div class="text-white font-semibold">${escapeHTML(request.plan || "—")}</div></div>
              <div><div class="text-gray-500">Amount</div><div class="text-white font-semibold">${escapeHTML(request.amount ?? "—")} ${escapeHTML(request.currency || "ETB")}</div></div>
              <div><div class="text-gray-500">Payment method</div><div class="text-white">${escapeHTML(paymentNames[request.paymentMethod] || request.paymentMethod || "—")}</div></div>
              <div><div class="text-gray-500">Transaction reference</div><div class="text-white break-all">${escapeHTML(request.transactionReference || "—")}</div></div>
            </div>
            <div class="text-xs text-gray-500">Submitted: ${escapeHTML(formatDate(request.createdAt))}</div>
            ${request.screenshotUrl ? `
              <a href="${escapeHTML(request.screenshotUrl)}" target="_blank" rel="noopener noreferrer"
                 class="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-blue-300">
                <i class="fa-solid fa-image mr-2"></i>View payment screenshot
              </a>` : `<div class="text-sm text-red-300">No screenshot URL found.</div>`}
            ${status === "pending" ? `
              <div class="flex flex-wrap gap-2 pt-2">
                <button data-action="approve" data-id="${escapeHTML(request.id || "")}"
                  class="rounded-xl bg-green-500 px-4 py-2 font-bold text-white">
                  <i class="fa-solid fa-check mr-1"></i>Approve
                </button>
                <button data-action="reject" data-id="${escapeHTML(request.id || "")}"
                  class="rounded-xl border border-red-400/40 px-4 py-2 font-bold text-red-300">
                  <i class="fa-solid fa-xmark mr-1"></i>Reject
                </button>
              </div>` : ""}
          </article>
        `;
      }).join("");
    } catch (error) {
      message.textContent = error.message;
      message.className = "text-sm text-red-400";
      list.innerHTML = `<div class="rounded-2xl border border-red-500/20 p-6 text-red-300">Failed to load requests.</div>`;
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadRequests);

  list.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const requestId = button.dataset.id;
    if (!requestId) {
      message.textContent = "Request ID is missing.";
      message.className = "text-sm text-red-400";
      return;
    }

    let body = {};
    if (action === "approve") {
      if (!confirm("ይህን Premium ክፍያ አጽድቀው?")) return;
    } else if (action === "reject") {
      if (!confirm("ይህን ማመልከቻ ውድቅ ማድረግ ይፈልጋሉ?")) return;
      body.reason = prompt("የውድቅ ምክንያት (አማራጭ):", "") || "";
    } else {
      return;
    }

    button.disabled = true;
    message.className = "text-sm text-gray-300";
    message.textContent = action === "approve" ? "Approving..." : "Rejecting...";

    try {
      await apiRequest(`/api/admin/premium/requests/${encodeURIComponent(requestId)}/${action}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      message.className = "text-sm text-green-400";
      message.textContent = action === "approve"
        ? "Premium request approved."
        : "Premium request rejected.";
      await loadRequests();
    } catch (error) {
      message.className = "text-sm text-red-400";
      message.textContent = error.message;
      button.disabled = false;
    }
  });

  await loadRequests();
}

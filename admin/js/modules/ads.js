import { db, auth } from "../../../js/firebase.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const adsRef = collection(db, "advertisements");

const CLOUDINARY_CLOUD_NAME = "dyfzl7jfg";
const CLOUDINARY_UPLOAD_PRESET = "footballxtranews";

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
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    return date.toLocaleDateString();
  } catch {
    return "—";
  }
}

async function uploadMedia(file, type) {
  if (!file) throw new Error("Please select a file.");

  const isImage = type === "image" || type === "gif";
  const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      `File is too large. Maximum size is ${isImage ? "10MB" : "50MB"}.`
    );
  }

  if (isImage && !file.type.startsWith("image/")) {
    throw new Error("Please select an image or GIF file.");
  }

  if (!isImage && !file.type.startsWith("video/")) {
    throw new Error("Please select a video file.");
  }

  const resourceType = isImage ? "image" : "video";
  const uploadUrl =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}).`);
  }

  const data = await response.json();

  if (!data.secure_url) {
    throw new Error("Upload succeeded but no media URL was returned.");
  }

  return data.secure_url;
}

export async function renderAdsModule(container) {
  container.innerHTML = `
    <div class="space-y-6">

      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black">Advertisement Management</h2>
          <p class="text-sm text-gray-500 mt-1">
            Manage homepage banners, GIFs and video advertisements.
          </p>
        </div>

        <button id="createAdBtn"
          class="px-5 py-3 rounded-xl bg-green-500 text-black font-black hover:bg-green-400 transition">
          <i class="fa-solid fa-plus mr-2"></i>
          Add Advertisement
        </button>
      </div>

      <div id="adEditor" class="hidden glass rounded-2xl p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 id="adEditorTitle" class="text-xl font-black">Add Advertisement</h3>
            <p class="text-xs text-gray-500 mt-1">
              Upload media and choose where the advertisement appears.
            </p>
          </div>

          <button id="closeAdEditor"
            class="w-9 h-9 rounded-lg glass text-gray-400 hover:text-white">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="adForm" class="space-y-5">

          <input type="hidden" id="adId">
          <input type="hidden" id="mediaUrl">

          <div class="grid md:grid-cols-2 gap-4">

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Advertisement Title
              </label>
              <input id="adTitle" required
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
                placeholder="Example: FootballXtra Sponsor Banner">
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Advertiser / Company
              </label>
              <input id="advertiser"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
                placeholder="Company name">
            </div>

          </div>

          <div class="grid md:grid-cols-3 gap-4">

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Media Type
              </label>
              <select id="adType"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none">
                <option value="image">Image</option>
                <option value="gif">GIF</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Placement
              </label>
              <select id="placement"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none">
                <option value="homepage">Homepage</option>
                <option value="news">News</option>
                <option value="videos">Videos</option>
                <option value="scores">Live Scores</option>
                <option value="all">All Pages</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Priority
              </label>
              <input id="priority" type="number" value="0"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
                placeholder="0">
            </div>

          </div>

          <div>
            <label class="block text-xs font-bold text-gray-400 mb-2">
              Media File
            </label>

            <input id="adMedia" type="file"
              accept="image/*,video/*"
              class="block w-full text-sm text-gray-400
                     file:mr-4 file:py-2 file:px-4 file:rounded-lg
                     file:border-0 file:bg-green-500 file:text-black file:font-bold">

            <div id="mediaStatus" class="text-xs text-gray-500 mt-2"></div>

            <div id="mediaPreview" class="hidden mt-4 rounded-xl overflow-hidden border border-white/10">
              <img id="imagePreview"
                class="hidden w-full max-h-72 object-contain bg-black">
              <video id="videoPreview"
                class="hidden w-full max-h-72 object-contain bg-black"
                controls muted playsinline></video>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-400 mb-2">
              Destination URL
            </label>
            <input id="clickUrl" type="url"
              class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-green-400"
              placeholder="https://example.com">
          </div>

          <div class="grid md:grid-cols-2 gap-4">

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                Start Date
              </label>
              <input id="startAt" type="datetime-local"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none">
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-400 mb-2">
                End Date
              </label>
              <input id="endAt" type="datetime-local"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none">
            </div>

          </div>

          <label class="flex items-center gap-3 cursor-pointer">
            <input id="active" type="checkbox" checked class="w-4 h-4 accent-green-500">
            <span class="text-sm font-bold">Advertisement Active</span>
          </label>

          <div class="flex gap-3">
            <button id="saveAdBtn" type="submit"
              class="px-5 py-3 rounded-xl bg-green-500 text-black font-black">
              <i class="fa-solid fa-save mr-2"></i>
              Save Advertisement
            </button>

            <button id="cancelAdBtn" type="button"
              class="px-5 py-3 rounded-xl glass font-bold">
              Cancel
            </button>
          </div>

        </form>
      </div>

      <div class="glass rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-white/10">
          <h3 class="font-black">Advertisements</h3>
        </div>

        <div id="adList">
          <div class="p-10 text-center text-gray-500">
            Loading advertisements...
          </div>
        </div>
      </div>

    </div>
  `;

  const editor = container.querySelector("#adEditor");
  const form = container.querySelector("#adForm");
  const mediaInput = container.querySelector("#adMedia");
  const mediaUrl = container.querySelector("#mediaUrl");
  const mediaStatus = container.querySelector("#mediaStatus");
  const mediaPreview = container.querySelector("#mediaPreview");
  const imagePreview = container.querySelector("#imagePreview");
  const videoPreview = container.querySelector("#videoPreview");

  function resetPreview() {
    mediaPreview.classList.add("hidden");
    imagePreview.classList.add("hidden");
    videoPreview.classList.add("hidden");
    imagePreview.src = "";
    videoPreview.src = "";
    mediaStatus.textContent = "";
  }

  function previewMedia(url, type) {
    if (!url) {
      resetPreview();
      return;
    }

    mediaPreview.classList.remove("hidden");

    if (type === "video") {
      imagePreview.classList.add("hidden");
      videoPreview.classList.remove("hidden");
      videoPreview.src = url;
    } else {
      videoPreview.classList.add("hidden");
      imagePreview.classList.remove("hidden");
      imagePreview.src = url;
    }
  }

  function openEditor(ad = null) {
    editor.classList.remove("hidden");

    if (!ad) {
      form.reset();
      container.querySelector("#adId").value = "";
      mediaUrl.value = "";
      container.querySelector("#priority").value = "0";
      container.querySelector("#active").checked = true;
      container.querySelector("#adType").value = "image";
      container.querySelector("#placement").value = "homepage";
      container.querySelector("#adEditorTitle").textContent = "Add Advertisement";
      resetPreview();
      return;
    }

    container.querySelector("#adEditorTitle").textContent = "Edit Advertisement";
    container.querySelector("#adId").value = ad.id;
    container.querySelector("#adTitle").value = ad.title || "";
    container.querySelector("#advertiser").value = ad.advertiser || "";
    container.querySelector("#adType").value = ad.type || "image";
    container.querySelector("#placement").value = ad.placement || "homepage";
    container.querySelector("#priority").value = ad.priority ?? 0;
    container.querySelector("#clickUrl").value = ad.clickUrl || "";
    container.querySelector("#active").checked = ad.active !== false;
    mediaUrl.value = ad.mediaUrl || "";

    previewMedia(ad.mediaUrl || "", ad.type || "image");
  }

  function closeEditor() {
    editor.classList.add("hidden");
    form.reset();
    mediaUrl.value = "";
    resetPreview();
  }

  mediaInput.addEventListener("change", async () => {
    const file = mediaInput.files?.[0];
    if (!file) return;

    const type = container.querySelector("#adType").value;

    try {
      mediaStatus.textContent = "Uploading media...";
      const url = await uploadMedia(file, type);
      mediaUrl.value = url;
      mediaStatus.textContent = "✓ Media uploaded successfully";
      previewMedia(url, type);
    } catch (error) {
      console.error("Advertisement upload error:", error);
      mediaStatus.textContent = "Upload failed: " + error.message;
      mediaUrl.value = "";
    }
  });

  container.querySelector("#createAdBtn")
    .addEventListener("click", () => openEditor());

  container.querySelector("#closeAdEditor")
    .addEventListener("click", closeEditor);

  container.querySelector("#cancelAdBtn")
    .addEventListener("click", closeEditor);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const id = container.querySelector("#adId").value;
    const title = container.querySelector("#adTitle").value.trim();
    const advertiser = container.querySelector("#advertiser").value.trim();
    const type = container.querySelector("#adType").value;
    const placement = container.querySelector("#placement").value;
    const clickUrl = container.querySelector("#clickUrl").value.trim();
    const priority = Number(container.querySelector("#priority").value || 0);
    const active = container.querySelector("#active").checked;

    if (!title) {
      alert("Advertisement title is required.");
      return;
    }

    if (!mediaUrl.value) {
      alert("Please upload advertisement media first.");
      return;
    }

    try {
      const button = container.querySelector("#saveAdBtn");
      button.disabled = true;
      button.innerHTML =
        `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...`;

      const user = auth.currentUser;

      const data = {
        title,
        advertiser,
        type,
        mediaUrl: mediaUrl.value,
        clickUrl,
        placement,
        active,
        priority,
        startAt: startAt.value ? new Date(startAt.value) : null,
        endAt: endAt.value ? new Date(endAt.value) : null,
        authorId: user?.uid || "",
        authorName: user?.displayName || "FootballXtra",
        updatedAt: serverTimestamp()
      };

      if (id) {
        await updateDoc(doc(db, "advertisements", id), data);
        alert("Advertisement updated successfully ✅");
      } else {
        await addDoc(adsRef, {
          ...data,
          createdAt: serverTimestamp()
        });
        alert("Advertisement created successfully 🎉");
      }

      closeEditor();
      await loadAds();

    } catch (error) {
      console.error("Advertisement save error:", error);
      alert("Could not save advertisement: " + error.message);
    } finally {
      const button = container.querySelector("#saveAdBtn");
      button.disabled = false;
      button.innerHTML =
        `<i class="fa-solid fa-save mr-2"></i> Save Advertisement`;
    }
  });

  async function loadAds() {
    const list = container.querySelector("#adList");

    try {
      const snapshot = await getDocs(
        query(adsRef, orderBy("createdAt", "desc"))
      );

      const ads = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      if (!ads.length) {
        list.innerHTML = `
          <div class="p-10 text-center text-gray-500">
            <i class="fa-solid fa-rectangle-ad text-3xl mb-3"></i>
            <p>No advertisements created yet.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = ads.map(ad => `
        <article class="p-5 border-b border-white/5">
          <div class="flex flex-col md:flex-row gap-4">

            <div class="w-full md:w-48 h-28 rounded-xl overflow-hidden bg-black flex-shrink-0">
              ${
                ad.type === "video"
                  ? `<video src="${escapeHTML(ad.mediaUrl || "")}"
                       class="w-full h-full object-cover" muted playsinline></video>`
                  : `<img src="${escapeHTML(ad.mediaUrl || "")}"
                       class="w-full h-full object-cover">`
              }
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap gap-2 mb-1">
                <span class="text-[10px] uppercase font-black text-green-400">
                  ${escapeHTML(ad.type || "image")}
                </span>

                <span class="text-[10px] uppercase font-black text-blue-400">
                  ${escapeHTML(ad.placement || "homepage")}
                </span>

                <span class="text-[10px] uppercase font-black ${
                  ad.active !== false ? "text-green-400" : "text-red-400"
                }">
                  ${ad.active !== false ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              <h4 class="font-black truncate">
                ${escapeHTML(ad.title || "Advertisement")}
              </h4>

              <p class="text-xs text-gray-500 mt-1">
                ${escapeHTML(ad.advertiser || "No advertiser")}
              </p>

              <div class="text-[10px] text-gray-600 mt-2">
                Priority: ${Number(ad.priority || 0)}
                · Created: ${formatDate(ad.createdAt)}
              </div>
            </div>

            <div class="flex md:flex-col gap-2">
              <button
                class="edit-ad w-10 h-10 rounded-lg glass text-blue-400"
                data-id="${ad.id}"
                title="Edit">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                class="toggle-ad w-10 h-10 rounded-lg glass ${
                  ad.active !== false ? "text-yellow-400" : "text-green-400"
                }"
                data-id="${ad.id}"
                title="Toggle active">
                <i class="fa-solid ${
                  ad.active !== false ? "fa-pause" : "fa-play"
                }"></i>
              </button>

              <button
                class="delete-ad w-10 h-10 rounded-lg glass text-red-400"
                data-id="${ad.id}"
                title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

          </div>
        </article>
      `).join("");

      list.querySelectorAll(".edit-ad").forEach(button => {
        button.addEventListener("click", () => {
          const ad = ads.find(item => item.id === button.dataset.id);
          if (ad) openEditor(ad);
        });
      });

      list.querySelectorAll(".toggle-ad").forEach(button => {
        button.addEventListener("click", async () => {
          const ad = ads.find(item => item.id === button.dataset.id);
          if (!ad) return;

          try {
            await updateDoc(
              doc(db, "advertisements", ad.id),
              {
                active: ad.active === false,
                updatedAt: serverTimestamp()
              }
            );

            await loadAds();
          } catch (error) {
            console.error("Advertisement toggle error:", error);
            alert("Could not change advertisement status.");
          }
        });
      });

      list.querySelectorAll(".delete-ad").forEach(button => {
        button.addEventListener("click", async () => {
          const ad = ads.find(item => item.id === button.dataset.id);
          if (!ad) return;

          if (!confirm(`Delete "${ad.title || "Advertisement"}"?`)) return;

          try {
            await deleteDoc(doc(db, "advertisements", ad.id));
            await loadAds();
          } catch (error) {
            console.error("Advertisement delete error:", error);
            alert("Could not delete advertisement: " + error.message);
          }
        });
      });

    } catch (error) {
      console.error("Advertisement load error:", error);
      list.innerHTML = `
        <div class="p-8 text-center text-red-400">
          Failed to load advertisements.
          <div class="text-xs text-gray-500 mt-2">
            ${escapeHTML(error.message)}
          </div>
        </div>
      `;
    }
  }

  await loadAds();
}

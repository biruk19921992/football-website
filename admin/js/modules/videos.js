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

const videosRef = collection(db, "posts");

const CLOUDINARY_CLOUD_NAME = "dyfzl7jfg";
const CLOUDINARY_UPLOAD_PRESET = "footballxtranews";

const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "Just now";
  return timestamp.toDate().toLocaleString();
}

function getYouTubeId(url = "") {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/
  );

  return match ? match[1] : "";
}

async function uploadToCloudinary(file) {

  if (!file) {
    throw new Error("Please select a thumbnail.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Thumbnail must be smaller than 10MB.");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append(
    "upload_preset",
    CLOUDINARY_UPLOAD_PRESET
  );

  const response = await fetch(
    CLOUDINARY_UPLOAD_URL,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    console.error("Cloudinary error:", data);

    throw new Error(
      data.error?.message ||
      "Cloudinary upload failed."
    );
  }

  return data.secure_url;
}

export async function renderVideosModule(container) {

  container.innerHTML = `

    <div class="space-y-5">

      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div>

          <div class="text-red-400 text-xs font-black tracking-widest">
            VIDEO MANAGEMENT
          </div>

          <h3 class="text-xl font-black mt-1">
            Videos & Highlights
          </h3>

          <p class="text-gray-500 text-sm mt-1">
            Publish YouTube videos and football highlights.
          </p>

        </div>

        <button
          id="createVideoBtn"
          class="px-5 py-3 rounded-xl bg-red-500 text-white font-black text-sm">

          <i class="fa-solid fa-plus mr-2"></i>
          Add Video

        </button>

      </div>


      <!-- EDITOR -->

      <div
        id="videoEditor"
        class="hidden glass rounded-2xl p-5">

        <div class="flex items-center justify-between mb-5">

          <div>

            <h4
              id="videoEditorTitle"
              class="font-black text-lg">

              Add Video

            </h4>

            <p class="text-xs text-gray-500 mt-1">
              Add a YouTube video to FootballXtra.
            </p>

          </div>

          <button
            id="closeVideoEditor"
            class="text-gray-500 hover:text-white">

            <i class="fa-solid fa-xmark text-xl"></i>

          </button>

        </div>


        <form id="videoForm" class="space-y-5">

          <input type="hidden" id="videoId">


          <!-- TITLE -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              Video Title
            </label>

            <input
              id="videoTitle"
              required
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-red-500"
              placeholder="Manchester United highlights...">

          </div>


          <!-- DESCRIPTION -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              Description
            </label>

            <textarea
              id="videoDescription"
              rows="5"
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-red-500"
              placeholder="Describe the video..."></textarea>

          </div>


          <!-- YOUTUBE -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              YouTube URL
            </label>

            <input
              id="youtubeUrl"
              required
              type="url"
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-red-500"
              placeholder="https://www.youtube.com/watch?v=...">

            <div
              id="youtubePreview"
              class="hidden mt-3 rounded-xl overflow-hidden bg-black aspect-video">

              <iframe
                id="youtubeFrame"
                class="w-full h-full"
                allowfullscreen>
              </iframe>

            </div>

          </div>


          <!-- THUMBNAIL -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              Thumbnail
            </label>

            <div
              id="thumbnailDropZone"
              class="mt-2 border border-dashed border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:border-red-500/50">

              <input
                id="videoThumbnail"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden">

              <div id="thumbnailPlaceholder">

                <div class="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center text-xl">

                  <i class="fa-solid fa-image"></i>

                </div>

                <p class="font-bold text-sm mt-3">
                  Choose Thumbnail
                </p>

                <p class="text-xs text-gray-500 mt-1">
                  JPG, PNG or WEBP • Max 10MB
                </p>

              </div>


              <div
                id="thumbnailPreviewWrapper"
                class="hidden">

                <img
                  id="thumbnailPreview"
                  class="w-full max-h-72 object-cover rounded-xl">

                <div
                  id="thumbnailStatus"
                  class="text-xs text-red-400 font-bold mt-3">
                </div>

              </div>

            </div>

            <input
              type="hidden"
              id="thumbnailUrl">

          </div>


          <!-- CATEGORY -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              Category
            </label>

            <select
              id="videoCategory"
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-red-500">

              <option value="highlights">
                Match Highlights
              </option>

              <option value="goals">
                Goals
              </option>

              <option value="interviews">
                Interviews
              </option>

              <option value="analysis">
                Football Analysis
              </option>

              <option value="news">
                Football News
              </option>

              <option value="shorts">
                Shorts
              </option>

            </select>

          </div>


          <div class="flex flex-wrap gap-3">

            <button
              id="publishVideoBtn"
              type="submit"
              class="px-6 py-3 rounded-xl bg-red-500 text-white font-black">

              <i class="fa-solid fa-paper-plane mr-2"></i>
              Publish Video

            </button>

            <button
              type="button"
              id="cancelVideoBtn"
              class="px-6 py-3 rounded-xl glass font-bold">

              Cancel

            </button>

          </div>

        </form>

      </div>


      <!-- VIDEO LIST -->

      <div class="glass rounded-2xl overflow-hidden">

        <div class="p-5 border-b border-white/5">

          <h4 class="font-black">
            Published Videos
          </h4>

        </div>

        <div id="videoList">

          <div class="p-10 text-center text-gray-500">

            <i class="fa-solid fa-spinner fa-spin text-red-400 text-xl"></i>

            <p class="mt-2 text-sm">
              Loading videos...
            </p>

          </div>

        </div>

      </div>

    </div>
  `;


  const editor =
    container.querySelector("#videoEditor");

  const form =
    container.querySelector("#videoForm");

  const thumbnailInput =
    container.querySelector("#videoThumbnail");

  const dropZone =
    container.querySelector("#thumbnailDropZone");

  const preview =
    container.querySelector("#thumbnailPreview");

  const previewWrapper =
    container.querySelector("#thumbnailPreviewWrapper");

  const placeholder =
    container.querySelector("#thumbnailPlaceholder");

  const thumbnailStatus =
    container.querySelector("#thumbnailStatus");

  const thumbnailUrl =
    container.querySelector("#thumbnailUrl");

  const youtubeUrl =
    container.querySelector("#youtubeUrl");

  const youtubePreview =
    container.querySelector("#youtubePreview");

  const youtubeFrame =
    container.querySelector("#youtubeFrame");


  /* YOUTUBE PREVIEW */

  youtubeUrl.addEventListener("input", () => {

    const id =
      getYouTubeId(youtubeUrl.value.trim());

    if (!id) {

      youtubePreview.classList.add("hidden");

      youtubeFrame.src = "";

      return;
    }

    youtubeFrame.src =
      `https://www.youtube.com/embed/${id}`;

    youtubePreview.classList.remove("hidden");

  });


  /* THUMBNAIL */

  dropZone.addEventListener(
    "click",
    () => thumbnailInput.click()
  );


  thumbnailInput.addEventListener(
    "change",
    async () => {

      const file =
        thumbnailInput.files[0];

      if (!file) return;


      preview.src =
        URL.createObjectURL(file);

      placeholder.classList.add("hidden");

      previewWrapper.classList.remove("hidden");

      thumbnailStatus.textContent =
        "Uploading to Cloudinary...";


      try {

        const url =
          await uploadToCloudinary(file);

        thumbnailUrl.value =
          url;

        thumbnailStatus.textContent =
          "✓ Uploaded to Cloudinary";

      } catch (error) {

        console.error(error);

        thumbnailUrl.value = "";

        thumbnailStatus.textContent =
          "Upload failed: " +
          error.message;

      }

    }
  );


  function openEditor(video = null) {

    editor.classList.remove("hidden");


    if (!video) {

      form.reset();

      container.querySelector("#videoId").value = "";

      thumbnailUrl.value = "";

      youtubePreview.classList.add("hidden");

      youtubeFrame.src = "";

      placeholder.classList.remove("hidden");

      previewWrapper.classList.add("hidden");

      thumbnailStatus.textContent = "";

      container.querySelector(
        "#videoEditorTitle"
      ).textContent = "Add Video";

      return;
    }


    container.querySelector(
      "#videoEditorTitle"
    ).textContent = "Edit Video";


    container.querySelector("#videoId").value =
      video.id;

    container.querySelector("#videoTitle").value =
      video.title || "";

    container.querySelector("#videoDescription").value =
      video.content || "";

    container.querySelector("#youtubeUrl").value =
      video.videoUrl || "";

    container.querySelector("#videoCategory").value =
      video.category || "highlights";

    thumbnailUrl.value =
      video.thumbnailUrl || "";


    const id =
      getYouTubeId(video.videoUrl || "");

    if (id) {

      youtubeFrame.src =
        `https://www.youtube.com/embed/${id}`;

      youtubePreview.classList.remove("hidden");

    }


    if (video.thumbnailUrl) {

      preview.src =
        video.thumbnailUrl;

      placeholder.classList.add("hidden");

      previewWrapper.classList.remove("hidden");

      thumbnailStatus.textContent =
        "✓ Current thumbnail";

    }

  }


  function closeEditor() {

    editor.classList.add("hidden");

    form.reset();

    thumbnailUrl.value = "";

    youtubeFrame.src = "";

    youtubePreview.classList.add("hidden");

    placeholder.classList.remove("hidden");

    previewWrapper.classList.add("hidden");

    thumbnailStatus.textContent = "";

  }


  container.querySelector("#createVideoBtn")
    .addEventListener(
      "click",
      () => openEditor()
    );


  container.querySelector("#closeVideoEditor")
    .addEventListener(
      "click",
      closeEditor
    );


  container.querySelector("#cancelVideoBtn")
    .addEventListener(
      "click",
      closeEditor
    );


  /* SAVE */

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const videoId =
        container.querySelector("#videoId").value;


      const title =
        container.querySelector("#videoTitle")
          .value.trim();


      const description =
        container.querySelector("#videoDescription")
          .value.trim();


      const videoUrl =
        youtubeUrl.value.trim();


      const category =
        container.querySelector("#videoCategory")
          .value;


      if (!title) {

        alert("Video title is required.");

        return;
      }


      const youtubeId =
        getYouTubeId(videoUrl);


      if (!youtubeId) {

        alert(
          "Please enter a valid YouTube URL."
        );

        return;
      }


      if (!thumbnailUrl.value) {

        alert(
          "Please upload a thumbnail first."
        );

        return;
      }


      try {

        const button =
          container.querySelector("#publishVideoBtn");

        button.disabled = true;

        button.innerHTML =
          `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...`;


        const user =
          auth.currentUser;


        const data = {

          type: "video",

          title,

          content: description,

          videoUrl,

          youtubeId,

          thumbnailUrl:
            thumbnailUrl.value,

          image:
            thumbnailUrl.value,

          category,

          authorId:
            user?.uid || "",

          authorName:
            user?.displayName ||
            "FootballXtra",

          updatedAt:
            serverTimestamp()

        };


        if (videoId) {

          await updateDoc(
            doc(db, "posts", videoId),
            data
          );

          alert(
            "Video updated successfully ✅"
          );

        } else {

          await addDoc(
            videosRef,
            {

              ...data,

              likesCount: 0,

              commentsCount: 0,

              repostsCount: 0,

              createdAt:
                serverTimestamp()

            }
          );

          alert(
            "Video published successfully 🎉"
          );

        }


        closeEditor();

        await loadVideos();


      } catch (error) {

        console.error(
          "Video save error:",
          error
        );

        alert(
          "Could not save video: " +
          error.message
        );


      } finally {

        const button =
          container.querySelector("#publishVideoBtn");

        button.disabled = false;

        button.innerHTML =
          `<i class="fa-solid fa-paper-plane mr-2"></i> Publish Video`;

      }

    }
  );


  /* LOAD */

  async function loadVideos() {

    const list =
      container.querySelector("#videoList");


    try {

      const q =
        query(
          videosRef,
          orderBy(
            "createdAt",
            "desc"
          )
        );


      const snapshot =
        await getDocs(q);


      const videos =
        snapshot.docs
          .map(item => ({
            id: item.id,
            ...item.data()
          }))
          .filter(
            item =>
              item.type === "video"
          );


      if (!videos.length) {

        list.innerHTML = `

          <div class="p-10 text-center text-gray-500">

            <i class="fa-solid fa-video text-3xl mb-3"></i>

            <p>
              No videos published yet.
            </p>

          </div>

        `;

        return;
      }


      list.innerHTML =
        videos.map(item => `

          <article
            class="p-5 border-b border-white/5 hover:bg-white/[.02]">

            <div class="flex gap-4">

              <div class="relative flex-shrink-0">

                <img
                  src="${escapeHTML(item.thumbnailUrl || item.image || "")}"
                  class="w-28 h-20 md:w-40 md:h-24 object-cover rounded-xl">

                <div class="absolute inset-0 flex items-center justify-center">

                  <div class="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">

                    <i class="fa-solid fa-play text-white text-xs"></i>

                  </div>

                </div>

              </div>


              <div class="flex-1 min-w-0">

                <span class="text-[10px] uppercase font-bold text-red-400">

                  ${escapeHTML(
                    item.category ||
                    "highlights"
                  )}

                </span>


                <h5 class="font-black truncate mt-1">

                  ${escapeHTML(
                    item.title
                  )}

                </h5>


                <p class="text-gray-500 text-xs mt-1 line-clamp-2">

                  ${escapeHTML(
                    item.content || ""
                  )}

                </p>


                <div class="text-[10px] text-gray-600 mt-2">

                  ${formatDate(
                    item.createdAt
                  )}

                </div>

              </div>


              <div class="flex gap-2">

                <button
                  class="edit-video w-9 h-9 rounded-lg glass text-blue-400"
                  data-id="${item.id}">

                  <i class="fa-solid fa-pen"></i>

                </button>


                <button
                  class="delete-video w-9 h-9 rounded-lg glass text-red-400"
                  data-id="${item.id}">

                  <i class="fa-solid fa-trash"></i>

                </button>

              </div>

            </div>

          </article>

        `).join("");


      list.querySelectorAll(".edit-video")
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                videos.find(
                  v =>
                    v.id ===
                    button.dataset.id
                );

              if (item) {
                openEditor(item);
              }

            }
          );

        });


      list.querySelectorAll(".delete-video")
        .forEach(button => {

          button.addEventListener(
            "click",
            async () => {

              if (
                !confirm(
                  "Delete this video permanently?"
                )
              ) return;


              try {

                await deleteDoc(
                  doc(
                    db,
                    "posts",
                    button.dataset.id
                  )
                );

                await loadVideos();

              } catch (error) {

                console.error(error);

                alert(
                  "Delete failed: " +
                  error.message
                );

              }

            }
          );

        });


    } catch (error) {

      console.error(
        "Video loading error:",
        error
      );

      list.innerHTML = `

        <div class="p-10 text-center text-red-400">

          Failed to load videos.

          <div class="text-xs text-gray-500 mt-2">
            ${escapeHTML(error.message)}
          </div>

        </div>

      `;

    }

  }


  await loadVideos();

}

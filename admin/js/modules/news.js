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


const postsRef = collection(db, "posts");

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


/* ================= CLOUDINARY ================= */

async function uploadToCloudinary(file) {

  if (!file) {
    throw new Error("Please select a photo.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const maxSize = 10 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("Image must be smaller than 10MB.");
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

    console.error(
      "Cloudinary error:",
      data
    );

    throw new Error(
      data.error?.message ||
      "Cloudinary upload failed."
    );
  }


  return data.secure_url;
}


/* ================= MODULE ================= */

export async function renderNewsModule(container) {

  container.innerHTML = `

    <div class="space-y-5">

      <!-- HEADER -->

      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div>

          <div class="text-green-400 text-xs font-black tracking-widest">
            CONTENT MANAGEMENT
          </div>

          <h3 class="text-xl font-black mt-1">
            News Management
          </h3>

          <p class="text-gray-500 text-sm mt-1">
            Create, edit and publish FootballXtra news.
          </p>

        </div>


        <button
          id="createNewsBtn"
          class="px-5 py-3 rounded-xl bg-green-500 text-black font-black text-sm">

          <i class="fa-solid fa-plus mr-2"></i>

          Create News

        </button>

      </div>


      <!-- EDITOR -->

      <div
        id="newsEditor"
        class="hidden glass rounded-2xl p-5">

        <div class="flex items-center justify-between mb-5">

          <div>

            <h4
              id="newsEditorTitle"
              class="font-black text-lg">

              Create News

            </h4>

            <p class="text-xs text-gray-500 mt-1">
              Publish a new football story.
            </p>

          </div>


          <button
            id="closeNewsEditor"
            class="text-gray-500 hover:text-white">

            <i class="fa-solid fa-xmark text-xl"></i>

          </button>

        </div>


        <form
          id="newsForm"
          class="space-y-5">

          <input
            type="hidden"
            id="newsId">


          <!-- TITLE -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              News Title
            </label>

            <input
              id="newsTitle"
              required
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-green-500"
              placeholder="Enter news headline">

          </div>


          <!-- CONTENT -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              News Content
            </label>

            <textarea
              id="newsContent"
              required
              rows="7"
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-green-500"
              placeholder="Write your football news..."></textarea>

          </div>


          <!-- PHOTO -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              News Photo
            </label>


            <div
              id="photoDropZone"
              class="mt-2 border border-dashed border-white/10 rounded-2xl p-5 text-center hover:border-green-500/50 transition cursor-pointer">

              <input
                type="file"
                id="newsPhoto"
                accept="image/jpeg,image/png,image/webp"
                class="hidden">


              <div id="photoPlaceholder">

                <div class="w-14 h-14 mx-auto rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center text-xl">

                  <i class="fa-solid fa-cloud-arrow-up"></i>

                </div>

                <p class="font-bold text-sm mt-3">
                  Choose News Photo
                </p>

                <p class="text-xs text-gray-500 mt-1">
                  JPG, PNG or WEBP • Max 10MB
                </p>

              </div>


              <div
                id="photoPreviewWrapper"
                class="hidden">

                <img
                  id="photoPreview"
                  class="w-full max-h-72 object-cover rounded-xl">

                <div
                  id="uploadStatus"
                  class="text-xs text-green-400 font-bold mt-3">
                </div>

              </div>

            </div>


            <input
              type="hidden"
              id="newsImage">

          </div>


          <!-- CATEGORY -->

          <div>

            <label class="text-xs text-gray-400 font-bold">
              Category
            </label>

            <select
              id="newsCategory"
              class="w-full mt-2 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-green-500">

              <option value="football">
                Football
              </option>

              <option value="premier_league">
                Premier League
              </option>

              <option value="champions_league">
                Champions League
              </option>

              <option value="transfers">
                Transfers
              </option>

              <option value="ethiopian_football">
                Ethiopian Football
              </option>

            </select>

          </div>


          <!-- BUTTONS -->

          <div class="flex flex-wrap gap-3 pt-2">

            <button
              id="publishNewsBtn"
              type="submit"
              class="px-6 py-3 rounded-xl bg-green-500 text-black font-black">

              <i class="fa-solid fa-cloud-arrow-up mr-2"></i>

              Publish News

            </button>


            <button
              type="button"
              id="cancelNewsBtn"
              class="px-6 py-3 rounded-xl glass font-bold">

              Cancel

            </button>

          </div>

        </form>

      </div>


      <!-- NEWS LIST -->

      <div class="glass rounded-2xl overflow-hidden">

        <div class="p-5 border-b border-white/5">

          <h4 class="font-black">
            Published News
          </h4>

        </div>


        <div id="newsList">

          <div class="p-10 text-center text-gray-500">

            <i class="fa-solid fa-spinner fa-spin text-green-400 text-xl"></i>

            <p class="mt-2 text-sm">
              Loading news...
            </p>

          </div>

        </div>

      </div>

    </div>
  `;


  const editor =
    container.querySelector("#newsEditor");

  const form =
    container.querySelector("#newsForm");

  const photoInput =
    container.querySelector("#newsPhoto");

  const dropZone =
    container.querySelector("#photoDropZone");

  const previewWrapper =
    container.querySelector("#photoPreviewWrapper");

  const preview =
    container.querySelector("#photoPreview");

  const placeholder =
    container.querySelector("#photoPlaceholder");

  const uploadStatus =
    container.querySelector("#uploadStatus");

  const imageInput =
    container.querySelector("#newsImage");

  const publishButton =
    container.querySelector("#publishNewsBtn");


  /* ================= PHOTO PICKER ================= */

  dropZone.addEventListener(
    "click",
    () => photoInput.click()
  );


  photoInput.addEventListener(
    "change",
    async () => {

      const file =
        photoInput.files[0];

      if (!file) return;


      preview.src =
        URL.createObjectURL(file);

      placeholder.classList.add("hidden");

      previewWrapper.classList.remove("hidden");

      uploadStatus.textContent =
        "Uploading to Cloudinary...";


      try {

        const url =
          await uploadToCloudinary(file);

        imageInput.value = url;

        uploadStatus.textContent =
          "✓ Uploaded to Cloudinary";

        uploadStatus.className =
          "text-xs text-green-400 font-bold mt-3";


      } catch (error) {

        console.error(error);

        imageInput.value = "";

        uploadStatus.textContent =
          "Upload failed: " +
          error.message;

        uploadStatus.className =
          "text-xs text-red-400 font-bold mt-3";

      }

    }
  );


  /* ================= EDITOR ================= */

  function openEditor(news = null) {

    editor.classList.remove("hidden");


    if (!news) {

      form.reset();

      container.querySelector("#newsId").value = "";

      placeholder.classList.remove("hidden");

      previewWrapper.classList.add("hidden");

      imageInput.value = "";

      uploadStatus.textContent = "";

      container.querySelector(
        "#newsEditorTitle"
      ).textContent = "Create News";

      return;
    }


    container.querySelector(
      "#newsEditorTitle"
    ).textContent = "Edit News";


    container.querySelector("#newsId").value =
      news.id;

    container.querySelector("#newsTitle").value =
      news.title || "";

    container.querySelector("#newsContent").value =
      news.content || "";

    container.querySelector("#newsCategory").value =
      news.category || "football";


    imageInput.value =
      news.image || "";


    if (news.image) {

      preview.src =
        news.image;

      placeholder.classList.add("hidden");

      previewWrapper.classList.remove("hidden");

      uploadStatus.textContent =
        "✓ Current image";

    } else {

      placeholder.classList.remove("hidden");

      previewWrapper.classList.add("hidden");

    }

  }


  function closeEditor() {

    editor.classList.add("hidden");

    form.reset();

    container.querySelector("#newsId").value = "";

    imageInput.value = "";

    placeholder.classList.remove("hidden");

    previewWrapper.classList.add("hidden");

    uploadStatus.textContent = "";

  }


  container.querySelector("#createNewsBtn")
    .addEventListener(
      "click",
      () => openEditor()
    );


  container.querySelector("#closeNewsEditor")
    .addEventListener(
      "click",
      closeEditor
    );


  container.querySelector("#cancelNewsBtn")
    .addEventListener(
      "click",
      closeEditor
    );


  /* ================= SAVE ================= */

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const newsId =
        container.querySelector("#newsId").value;


      const title =
        container.querySelector("#newsTitle")
          .value.trim();


      const content =
        container.querySelector("#newsContent")
          .value.trim();


      const image =
        imageInput.value.trim();


      const category =
        container.querySelector("#newsCategory")
          .value;


      if (!title || !content) {

        alert(
          "Title and content are required."
        );

        return;
      }


      if (!image) {

        alert(
          "Please upload a news photo first."
        );

        return;
      }


      try {

        publishButton.disabled = true;

        publishButton.innerHTML =
          `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...`;


        const user =
          auth.currentUser;


        const data = {

          type: "news",

          title,

          content,

          image,

          category,

          authorId:
            user?.uid || "",

          authorName:
            user?.displayName ||
            "FootballXtra",

          updatedAt:
            serverTimestamp()

        };


        if (newsId) {

          await updateDoc(
            doc(db, "posts", newsId),
            data
          );

          alert(
            "News updated successfully ✅"
          );

        } else {

          await addDoc(
            postsRef,
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
            "News published successfully 🎉"
          );

        }


        closeEditor();

        await loadNews();


      } catch (error) {

        console.error(
          "News save error:",
          error
        );

        alert(
          "Could not save news: " +
          error.message
        );


      } finally {

        publishButton.disabled = false;

        publishButton.innerHTML =
          `<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Publish News`;

      }

    }
  );


  /* ================= LOAD NEWS ================= */

  async function loadNews() {

    const list =
      container.querySelector("#newsList");


    try {

      const q =
        query(
          postsRef,
          orderBy(
            "createdAt",
            "desc"
          )
        );


      const snapshot =
        await getDocs(q);


      const news =
        snapshot.docs
          .map(item => ({
            id: item.id,
            ...item.data()
          }))
          .filter(
            item =>
              item.type === "news"
          );


      if (!news.length) {

        list.innerHTML = `

          <div class="p-10 text-center text-gray-500">

            <i class="fa-regular fa-newspaper text-3xl mb-3"></i>

            <p>
              No news published yet.
            </p>

          </div>

        `;

        return;
      }


      list.innerHTML =
        news.map(item => `

          <article
            class="p-5 border-b border-white/5 hover:bg-white/[.02]">

            <div class="flex gap-4">

              ${
                item.image
                ? `
                  <img
                    src="${escapeHTML(item.image)}"
                    class="w-24 h-20 md:w-32 md:h-24 object-cover rounded-xl">
                `
                : `
                  <div class="w-24 h-20 md:w-32 md:h-24 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                    <i class="fa-solid fa-newspaper text-2xl"></i>
                  </div>
                `
              }


              <div class="flex-1 min-w-0">

                <div class="flex flex-wrap gap-2 mb-1">

                  <span class="text-[10px] uppercase font-bold text-green-400">
                    ${escapeHTML(
                      item.category ||
                      "football"
                    )}
                  </span>

                </div>


                <h5 class="font-black truncate">
                  ${escapeHTML(
                    item.title
                  )}
                </h5>


                <p class="text-gray-500 text-xs mt-1 line-clamp-2">
                  ${escapeHTML(
                    item.content
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
                  class="edit-news w-9 h-9 rounded-lg glass text-blue-400"
                  data-id="${item.id}">

                  <i class="fa-solid fa-pen"></i>

                </button>


                <button
                  class="delete-news w-9 h-9 rounded-lg glass text-red-400"
                  data-id="${item.id}">

                  <i class="fa-solid fa-trash"></i>

                </button>

              </div>

            </div>

          </article>

        `).join("");


      list.querySelectorAll(".edit-news")
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                news.find(
                  n =>
                    n.id ===
                    button.dataset.id
                );

              if (item) {
                openEditor(item);
              }

            }
          );

        });


      list.querySelectorAll(".delete-news")
        .forEach(button => {

          button.addEventListener(
            "click",
            async () => {

              if (
                !confirm(
                  "Delete this news permanently?"
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


                await loadNews();


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
        "News loading error:",
        error
      );


      list.innerHTML = `

        <div class="p-10 text-center text-red-400">

          <i class="fa-solid fa-triangle-exclamation text-2xl"></i>

          <p class="mt-3">
            Failed to load news.
          </p>

          <div class="text-xs text-gray-500 mt-2">
            ${escapeHTML(
              error.message
            )}
          </div>

        </div>

      `;

    }

  }


  await loadNews();

}

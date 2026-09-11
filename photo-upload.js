import { watchAuth } from "./js/auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db, auth } from "./js/firebase.js";

const avatar = document.getElementById("avatar");
const changePhotoBtn = document.getElementById("changePhotoBtn");
const photoInput = document.getElementById("photoInput");

const CLOUDINARY_CLOUD_NAME = "dyfzl7jfg";
const CLOUDINARY_UPLOAD_PRESET = "footballxtra_profile";

async function loadProfilePhoto(user) {
  try {
    const snapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (snapshot.exists()) {
      const data = snapshot.data();

      if (data.photoURL && avatar) {
        avatar.innerHTML = "";

        const img = document.createElement("img");
        img.src = data.photoURL;
        img.alt = "Profile Photo";
        img.className = "w-full h-full object-cover";

        avatar.appendChild(img);
      }
    }
  } catch (error) {
    console.error("Photo loading error:", error);
  }
}

watchAuth(async (user) => {
  if (!user) return;

  await loadProfilePhoto(user);
});

if (changePhotoBtn && photoInput) {

  changePhotoBtn.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", async () => {

    const file = photoInput.files[0];
    const user = auth.currentUser;

    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Photo must be smaller than 5MB.");
      return;
    }

    changePhotoBtn.disabled = true;

    changePhotoBtn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {

      const formData = new FormData();

      formData.append("file", file);

      formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
      );

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        console.error("Cloudinary error:", result);
        throw new Error("Cloudinary upload failed");
      }

      const photoURL = result.secure_url;

      await setDoc(
        doc(db, "users", user.uid),
        {
          photoURL: photoURL,
          photoUpdatedAt: new Date()
        },
        {
          merge: true
        }
      );

      if (avatar) {

        avatar.innerHTML = "";

        const img = document.createElement("img");

        img.src = photoURL;
        img.alt = "Profile Photo";
        img.className =
          "w-full h-full object-cover";

        avatar.appendChild(img);
      }

      alert("Profile photo updated successfully!");

    } catch (error) {

      console.error(
        "Profile photo upload error:",
        error
      );

      alert(
        "Photo upload failed. Please try again."
      );

    } finally {

      changePhotoBtn.disabled = false;

      changePhotoBtn.innerHTML =
        '<i class="fa-solid fa-camera"></i>';

      photoInput.value = "";
    }
  });
}

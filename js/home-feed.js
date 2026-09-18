console.log("HOME-FEED START");
import { auth, db } from "./firebase.js";
console.log("FootballXtra: home-feed module loaded");

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  increment,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const feed = document.getElementById("homeSocialFeed");

if (!feed) {
  console.log("Home social feed container not found.");
} else {

  const demoPosts = [
    {
      id: "demo-news-1",
      type: "news",
      authorName: "FootballXtra",
      authorUsername: "@footballxtra",
      authorPhoto: "",
      verified: true,
      title: "Manchester United prepare for another exciting Premier League season",
      content:
        "The latest football news, transfer updates and everything happening around Manchester United.",
      image:
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80",
      likesCount: 1240,
      commentsCount: 245,
      repostsCount: 89,
      createdAt: null
    },
    {
      id: "demo-video-1",
      type: "video",
      authorName: "FootballXtra",
      authorUsername: "@footballxtra",
      authorPhoto: "",
      verified: true,
      title: "Football weekly show",
      content:
        "Watch the latest football stories, transfers and match discussions.",
      image:
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80",
      videoUrl: "",
      likesCount: 3400,
      commentsCount: 520,
      repostsCount: 310,
      createdAt: null
    }
  ];

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function timeAgo(timestamp) {

    if (!timestamp) return "Just now";

    const date =
      timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    const seconds =
      Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;

    const minutes =
      Math.floor(seconds / 60);

    if (minutes < 60) return `${minutes}m`;

    const hours =
      Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h`;

    const days =
      Math.floor(hours / 24);

    if (days < 7) return `${days}d`;

    return date.toLocaleDateString();
  }

  function avatar(post) {

    if (post.authorPhoto) {
      return `
        <img
          src="${escapeHTML(post.authorPhoto)}"
          class="w-11 h-11 rounded-full object-cover border border-green-400/50"
          alt="${escapeHTML(post.authorName)}">
      `;
    }

    return `
      <div class="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center font-black text-black">
        ${escapeHTML((post.authorName || "F").charAt(0).toUpperCase())}
      </div>
    `;
  }

  function formatNumber(number = 0) {

    number = Number(number || 0);

    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + "M";
    }

    if (number >= 1000) {
      return (number / 1000).toFixed(1) + "K";
    }

    return number;
  }

  function renderPost(post) {

    const isVideo =
      post.type === "video";

    return `
      <article
        class="social-post glass rounded-2xl overflow-hidden border border-white/10"
        data-post-id="${escapeHTML(post.id)}">

        <!-- AUTHOR -->

        <div class="p-4 flex items-start gap-3">

          ${avatar(post)}

          <div class="flex-1 min-w-0">

            <div class="flex items-center gap-1">

              <a
                href="#"
                class="font-bold hover:text-green-400">
                ${escapeHTML(post.authorName || "FootballXtra")}
              </a>

              ${
                post.verified
                  ? `
                    <span
                      class="w-4 h-4 rounded-full bg-green-500 text-black flex items-center justify-center text-[9px]"
                      title="Verified">
                      ✓
                    </span>
                  `
                  : ""
              }

            </div>

            <div class="text-xs text-gray-500 mt-0.5">
              ${escapeHTML(post.authorUsername || "@footballxtra")}
              ·
              ${timeAgo(post.createdAt)}
            </div>

          </div>

          <button
            class="text-gray-500 hover:text-white p-2"
            type="button">
            <i class="fa-solid fa-ellipsis"></i>
          </button>

        </div>


        <!-- CONTENT -->

        <div class="px-4 pb-3">

          ${
            isVideo
              ? `
                <span class="inline-flex items-center gap-2 text-red-400 text-xs font-bold mb-2">
                  <i class="fa-solid fa-video"></i>
                  VIDEO
                </span>
              `
              : `
                <span class="inline-flex items-center gap-2 text-green-400 text-xs font-bold mb-2">
                  <i class="fa-regular fa-newspaper"></i>
                  NEWS
                </span>
              `
          }

          <h3 class="font-bold text-lg leading-6">
            ${escapeHTML(post.title || "")}
          </h3>

          ${
            post.content
              ? `
                <p class="text-sm text-gray-400 mt-2 leading-6">
                  ${escapeHTML(post.content)}
                </p>
              `
              : ""
          }

        </div>


        <!-- MEDIA -->

        ${
          post.image
            ? `
              <div class="relative">

                <img
                  src="${escapeHTML(post.image)}"
                  class="w-full max-h-[500px] object-cover"
                  loading="lazy"
                  alt="Football post">

                ${
                  isVideo
                    ? `
                      <div class="absolute inset-0 flex items-center justify-center bg-black/20">

                        <button
                          type="button"
                          data-action="video" data-post-id="${escapeHTML(post.id)}" data-youtube-id="${escapeHTML(post.youtubeId || "")}" class="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 shadow-2xl flex items-center justify-center text-white text-xl">

                          <i class="fa-solid fa-play ml-1"></i>

                        </button>

                      </div>
                    `
                    : ""
                }

              </div>
            `
            : ""
        }


        <!-- COUNTS -->

        <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500">

          <span class="like-summary">
            ❤️ ${formatNumber(post.likesCount)}
          </span>

          <div class="flex gap-4">

            <span>
              💬 ${formatNumber(post.commentsCount)}
            </span>

            <span>
              🔁 ${formatNumber(post.repostsCount)}
            </span>

          </div>

        </div>


        <!-- ACTIONS -->

        <div class="grid grid-cols-4 border-t border-white/10">

          <button
            type="button"
            class="feed-action like-btn py-3 flex items-center justify-center gap-2 text-gray-400 hover:text-red-400 transition"
            data-action="like"
            data-post-id="${escapeHTML(post.id)}">

            <i class="fa-regular fa-heart"></i>
            <span>Like</span>

          </button>


          <button
            type="button"
            class="feed-action comment-btn py-3 flex items-center justify-center gap-2 text-gray-400 hover:text-green-400 transition"
            data-action="comment"
            data-post-id="${escapeHTML(post.id)}">

            <i class="fa-regular fa-comment"></i>
            <span>Comment</span>

          </button>


          <button
            type="button"
            class="feed-action repost-btn py-3 flex items-center justify-center gap-2 text-gray-400 hover:text-green-400 transition"
            data-action="repost"
            data-post-id="${escapeHTML(post.id)}">

            <i class="fa-solid fa-retweet"></i>
            <span>Repost</span>

          </button>


          <button
            type="button"
            class="feed-action share-btn py-3 flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400 transition"
            data-action="share"
            data-post-id="${escapeHTML(post.id)}">

            <i class="fa-solid fa-share"></i>
            <span>Share</span>

          </button>

        </div>


        <!-- COMMENTS -->

        <div
          class="comments-area hidden border-t border-white/10 p-4"
          data-comments="${escapeHTML(post.id)}">

          <div
            class="comments-list space-y-3 mb-3">
          </div>

          <div class="flex gap-2">

            <input
              type="text"
              class="comment-input flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-400"
              placeholder="Write a comment...">

            <button
              type="button"
              class="submit-comment bg-green-500 text-black px-4 rounded-xl font-bold">

              <i class="fa-solid fa-paper-plane"></i>

            </button>

          </div>

        </div>

      </article>
    `;
  }


  function showLoginMessage() {

    const go =
      confirm(
        "Please login to interact with posts.\n\nDo you want to login now?"
      );

    if (go) {
      window.location.href = "login.html";
    }

  }


  async function handleLike(postId, button) {

    const user = auth.currentUser;

    if (!user) {
      showLoginMessage();
      return;
    }

    if (postId.startsWith("demo-")) {
      button.classList.toggle("text-red-400");

      const icon =
        button.querySelector("i");

      if (icon) {
        icon.classList.toggle("fa-regular");
        icon.classList.toggle("fa-solid");
      }

      return;
    }

    const likeRef =
      doc(
        db,
        "posts",
        postId,
        "likes",
        user.uid
      );

    const existing =
      await getDoc(likeRef);

    const postRef =
      doc(db, "posts", postId);

    if (existing.exists()) {

      await deleteDoc(likeRef);

      await updateDoc(postRef, {
        likesCount: increment(-1)
      });

      button.classList.remove("text-red-400");

    } else {

      await setDoc(likeRef, {
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      await updateDoc(postRef, {
        likesCount: increment(1)
      });

      button.classList.add("text-red-400");
    }

  }


  function loadComments(postId, postElement) {
    const list =
      postElement?.querySelector(".comments-list");

    if (!list || postId.startsWith("demo-")) return;

    const commentsQuery = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(50)
    );

    onSnapshot(
      commentsQuery,
      snapshot => {
        if (snapshot.empty) {
          list.innerHTML =
            '<div class="text-xs text-gray-500 text-center py-2">No comments yet.</div>';
          return;
        }

        list.innerHTML = snapshot.docs.map(item => {
          const comment = item.data();

          return `
            <div class="flex gap-2 items-start">
              <div class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">
                ${escapeHTML((comment.userName || "U").charAt(0).toUpperCase())}
              </div>

              <div class="flex-1 min-w-0 bg-white/5 rounded-xl px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-white">
                    ${escapeHTML(comment.userName || "User")}
                  </span>

                  <span class="text-[10px] text-gray-500">
                    ${timeAgo(comment.createdAt)}
                  </span>
                </div>

                <p class="text-sm text-gray-300 mt-1 break-words">
                  ${escapeHTML(comment.text || "")}
                </p>
              </div>
            </div>
          `;
        }).join("");
      },
      error => {
        console.error("Comments loading error:", error);
        list.innerHTML =
          '<div class="text-xs text-red-400 text-center py-2">Could not load comments.</div>';
      }
    );
  }

  async function handleComment(postId, postElement) {

    const user = auth.currentUser;

    if (!user) {
      showLoginMessage();
      return;
    }

    const area =
      postElement.querySelector(
        ".comments-area"
      );

    if (area) {
      area.classList.toggle("hidden");

      if (!area.classList.contains("hidden")) {
        loadComments(postId, postElement);
      }
    }

  }


  async function submitComment(postId, postElement) {

    const user = auth.currentUser;

    if (!user) {
      showLoginMessage();
      return;
    }

    if (postId.startsWith("demo-")) {
      alert("Demo post. Create a Firebase post to save comments.");
      return;
    }

    const input =
      postElement.querySelector(
        ".comment-input"
      );

    const text =
      input?.value.trim();

    if (!text) return;

    await addDoc(
      collection(
        db,
        "posts",
        postId,
        "comments"
      ),
      {
        uid: user.uid,
        userName:
          user.displayName ||
          "User",
        userPhoto:
          user.photoURL ||
          "",
        text,
        createdAt:
          serverTimestamp()
      }
    );

    await updateDoc(
      doc(db, "posts", postId),
      {
        commentsCount:
          increment(1)
      }
    );

    input.value = "";

  }


  async function handleRepost(postId) {

    const user = auth.currentUser;

    if (!user) {
      showLoginMessage();
      return;
    }

    if (postId.startsWith("demo-")) {
      alert("Demo repost. Firebase post required.");
      return;
    }

    const repostRef =
      doc(
        db,
        "posts",
        postId,
        "reposts",
        user.uid
      );

    const existing =
      await getDoc(repostRef);

    if (existing.exists()) {

      alert("You already reposted this.");

      return;
    }

    await setDoc(repostRef, {
      uid: user.uid,
      createdAt: serverTimestamp()
    });

    await updateDoc(
      doc(db, "posts", postId),
      {
        repostsCount:
          increment(1)
      }
    );

    alert("Reposted successfully 🔁");

  }


  async function handleShare(postId) {

  const url =
    `${window.location.origin}/index.html#post-${postId}`;

  if (navigator.share) {

    try {

      await navigator.share({
        title: "FootballXtra",
        text: "Check this football post",
        url
      });

    } catch (error) {

      console.log("Share cancelled");

    }

  } else {

    try {

      await navigator.clipboard.writeText(url);

      alert("Post link copied!");

    } catch (error) {

      alert(url);

    }

  }

}


feed.addEventListener("click", async (event) => {

    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) return;

    const postId =
      button.dataset.postId;

    const postElement =
      button.closest(".social-post");

    try {

      if (button.dataset.action === "like") {
        await handleLike(postId, button);
      }

      if (button.dataset.action === "comment") {
        await handleComment(postId, postElement);
      }

      if (button.dataset.action === "repost") {
        await handleRepost(postId);
      }

      if (button.dataset.action === "share") {
        await handleShare(postId);
      }

      if (button.dataset.action === "video") {
        const youtubeId = button.dataset.youtubeId;
        if (!youtubeId) {
          alert("YouTube video not found.");
          return;
        }
        window.FootballXtraMiniPlayer?.play(youtubeId, button.dataset.title || "Football Video");

      }
    } catch (error) {

      console.error(
        "Feed action error:",
        error
      );

      alert(
        "Something went wrong. Please try again."
      );

    }

  });


  feed.addEventListener("click", async (event) => {

    if (
      !event.target.closest(
        ".submit-comment"
      )
    ) {
      return;
    }

    const postElement =
      event.target.closest(".social-post");

    const postId =
      postElement?.dataset.postId;

    if (!postId) return;

    try {

      await submitComment(
        postId,
        postElement
      );

    } catch (error) {

      console.error(
        "Comment error:",
        error
      );

      alert(
        "Could not post comment."
      );

    }

  });


  async function loadFirestorePosts() {
    console.log("FootballXtra: loadFirestorePosts STARTED");
    console.log("FootballXtra: loading latest news from API");

    feed.innerHTML =
      '<div class="p-6 text-center text-gray-400">Loading latest news...</div>';

    try {
      const response = await fetch(
        "https://footballxtra-website.onrender.com/api/news?refresh=" +
        Date.now()
      );

      if (!response.ok) {
        throw new Error("News API HTTP " + response.status);
      }

      const data = await response.json();
      const news = Array.isArray(data.news) ? data.news : [];

      if (!news.length) {
        feed.innerHTML =
          '<div class="p-6 text-center text-gray-400">No news available.</div>';
        return;
      }

      const posts = news.slice(0, 20).map((item) => ({
        id: "api-news-" + (item.id || crypto.randomUUID()),
        type: "news",
        authorName: item.source || "FootballXtra",
        authorUsername: item.source
          ? "@" + String(item.source).toLowerCase().replace(/[^a-z0-9]/g, "")
          : "@footballxtra",
        authorPhoto: "",
        verified: true,
        title: item.titleAm || item.headline || item.title || "",
        content:
          item.descriptionAm ||
          item.description ||
          "",
        image: item.image || "",
        likesCount: Number(item.likesCount || 0),
        commentsCount: Number(item.commentsCount || 0),
        repostsCount: Number(item.repostsCount || 0),
        createdAt: item.published || null,
        sourceUrl: item.sourceUrl || item.link || ""
      }));

      feed.innerHTML = posts.map(renderPost).join("");

      console.log(
        "FootballXtra: API news loaded:",
        posts.length
      );
    } catch (error) {
      console.error(
        "News API loading error:",
        error
      );

      feed.innerHTML =
        '<div class="p-6 text-center text-red-400">Could not load latest news.</div>';
    }
  }

  loadFirestorePosts();


}

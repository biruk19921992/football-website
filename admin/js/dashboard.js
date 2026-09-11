import { db } from "../../js/firebase.js";

import {
  collection,
  getCountFromServer,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export async function loadDashboardStats() {

  const stats = {
    users: 0,
    posts: 0,
    news: 0,
    videos: 0,
    matches: 0,
    reports: 0
  };

  try {
    const usersSnap =
      await getCountFromServer(
        collection(db, "users")
      );

    stats.users =
      usersSnap.data().count;
  } catch (error) {
    console.warn("Users count error:", error);
  }

  try {
    const postsSnap =
      await getCountFromServer(
        collection(db, "posts")
      );

    stats.posts =
      postsSnap.data().count;
  } catch (error) {
    console.warn("Posts count error:", error);
  }

  try {
    const newsSnap =
      await getCountFromServer(
        query(
          collection(db, "posts"),
          where("type", "==", "news")
        )
      );

    stats.news =
      newsSnap.data().count;
  } catch (error) {
    console.warn("News count error:", error);
  }

  try {
    const videoSnap =
      await getCountFromServer(
        query(
          collection(db, "posts"),
          where("type", "==", "video")
        )
      );

    stats.videos =
      videoSnap.data().count;
  } catch (error) {
    console.warn("Video count error:", error);
  }

  try {
    const matchesSnap =
      await getCountFromServer(
        collection(db, "matches")
      );

    stats.matches =
      matchesSnap.data().count;
  } catch (error) {
    console.warn("Matches collection not ready:", error);
  }

  try {
    const reportsSnap =
      await getCountFromServer(
        collection(db, "reports")
      );

    stats.reports =
      reportsSnap.data().count;
  } catch (error) {
    console.warn("Reports collection not ready:", error);
  }

  return stats;
}


export function updateDashboardUI(stats) {

  const elements = {
    users: document.getElementById("statUsers"),
    posts: document.getElementById("statPosts"),
    news: document.getElementById("statNews"),
    videos: document.getElementById("statVideos"),
    matches: document.getElementById("statMatches"),
    reports: document.getElementById("statReports")
  };

  if (elements.users)
    elements.users.textContent = stats.users.toLocaleString();

  if (elements.posts)
    elements.posts.textContent = stats.posts.toLocaleString();

  if (elements.news)
    elements.news.textContent = stats.news.toLocaleString();

  if (elements.videos)
    elements.videos.textContent = stats.videos.toLocaleString();

  if (elements.matches)
    elements.matches.textContent = stats.matches.toLocaleString();

  if (elements.reports)
    elements.reports.textContent = stats.reports.toLocaleString();
}


export async function refreshDashboard() {

  const stats =
    await loadDashboardStats();

  updateDashboardUI(stats);

  return stats;
}

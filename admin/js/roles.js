import { auth, db } from "../../js/firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const ROLE_PERMISSIONS = {

  super_admin: [
    "dashboard",
    "news",
    "transfers",
    "gallery",
    "videos",
    "highlights",
    "youtube",
    "matches",
    "live_scores",
    "lineups",
    "league_tables",
    "community",
    "comments",
    "reports",
    "advertisements",
    "sponsors",
    "premium",
    "affiliates",
    "revenue",
    "add_admin",
    "admin_users",
    "permissions",
    "settings",
    "notifications",
    "security"
  ],

  content_admin: [
    "dashboard",
    "news",
    "transfers",
    "gallery"
  ],

  video_admin: [
    "dashboard",
    "videos",
    "highlights",
    "youtube"
  ],

  match_admin: [
    "dashboard",
    "matches",
    "live_scores",
    "lineups",
    "league_tables"
  ],

  moderator_admin: [
    "dashboard",
    "community",
    "comments",
    "reports"
  ]

};


const ROLE_NAMES = {

  super_admin: "Super Admin",

  content_admin: "Content / News Admin",

  video_admin: "Video / Highlight Admin",

  match_admin: "Match Data Admin",

  moderator_admin: "Community Moderator"

};


export async function getCurrentAdmin() {

  const user = auth.currentUser;

  if (!user) {
    return {
      authorized: false,
      reason: "not_logged_in"
    };
  }

  try {

    const userRef =
      doc(db, "users", user.uid);

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) {

      return {
        authorized: false,
        reason: "user_document_missing"
      };

    }

    const profile =
      userSnap.data();

    const role =
      profile.role || "user";

    if (!ROLE_PERMISSIONS[role]) {

      return {
        authorized: false,
        reason: "not_admin",
        role
      };

    }

    return {

      authorized: true,

      uid: user.uid,

      email: user.email,

      name:
        profile.name ||
        user.displayName ||
        "Admin",

      photoURL:
        profile.photoURL ||
        user.photoURL ||
        "",

      role: role,

      roleName:
        ROLE_NAMES[role],

      permissions:
        ROLE_PERMISSIONS[role]

    };

  } catch (error) {

    console.error(
      "Admin role error:",
      error: error?.message || String(error)
    );

    return {
      authorized: false,
      reason: "firebase_error",
      error: error?.message || String(error)
    };

  }

}


export function hasPermission(
  admin,
  permission
) {

  if (!admin || !admin.authorized) {
    return false;
  }

  return admin.permissions.includes(
    permission
  );

}


export function isSuperAdmin(admin) {

  return (
    admin &&
    admin.authorized &&
    admin.role === "super_admin"
  );

}


export function getRoleName(role) {

  return (
    ROLE_NAMES[role] ||
    "User"
  );

}


export function getAllRoles() {

  return Object.entries(
    ROLE_NAMES
  ).map(([id, name]) => ({
    id,
    name,
    permissions:
      ROLE_PERMISSIONS[id] || []
  }));

}


export function applyRolePermissions(
  admin
) {

  if (!admin || !admin.authorized) {
    return;
  }

  document
    .querySelectorAll("[data-permission]")
    .forEach(element => {

      const permission =
        element.dataset.permission;

      if (
        !hasPermission(
          admin,
          permission
        )
      ) {

        element.style.display = "none";

      }

    });


  document
    .querySelectorAll("[data-super-admin]")
    .forEach(element => {

      if (!isSuperAdmin(admin)) {

        element.style.display = "none";

      }

    });

}


export async function requireAdmin() {

  return await getCurrentAdmin();

}

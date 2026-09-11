import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// ===============================
// SIGN UP
// ===============================

export async function signup(name, email, password) {
  try {

    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCredential.user;

    // Add user's display name
    await updateProfile(user, {
      displayName: name
    });

    // Save user profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: name,
      email: email,
      role: "user",
      premium: false,
      createdAt: serverTimestamp()
    });

    return {
      success: true,
      user: user
    };

  } catch (error) {

    console.error("Signup Error:", error);

    return {
      success: false,
      error: error
    };
  }
}


// ===============================
// LOGIN
// ===============================

export async function login(email, password) {

  try {

    const userCredential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    return {
      success: true,
      user: userCredential.user
    };

  } catch (error) {

    console.error("Login Error:", error);

    return {
      success: false,
      error: error
    };
  }
}


// ===============================
// LOGOUT
// ===============================

export async function logout() {

  try {

    await signOut(auth);

    return true;

  } catch (error) {

    console.error("Logout Error:", error);

    return false;
  }
}


// ===============================
// AUTH STATE
// ===============================

export function watchAuth(callback) {

  return onAuthStateChanged(auth, callback);

}

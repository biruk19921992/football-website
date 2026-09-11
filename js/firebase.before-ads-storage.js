import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHyMeEhyjGbUXHd176W4kLQ6RiJ53IESU",
  authDomain: "footballxtra.firebaseapp.com",
  projectId: "footballxtra",
  storageBucket: "footballxtra.firebasestorage.app",
  messagingSenderId: "833152958281",
  appId: "1:833152958281:web:b299b100a897aa4de1a498",
  measurementId: "G-PDK224GN6R"
};

const app = initializeApp(firebaseConfig);

let analytics = null;

try {
  analytics = getAnalytics(app);
} catch (error) {
  console.log("Analytics unavailable:", error);
}

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export {
  app,
  analytics,
  auth,
  db,
  rtdb
};

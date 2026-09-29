import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const telegramNewsConfig = {
  apiKey: "AIzaSyDEi8RtPb-d4_AZ4ch6gc-UgXgbWkY54us",
  authDomain: "footballxtra-telegram-news.firebaseapp.com",
  projectId: "footballxtra-telegram-news",
  storageBucket: "footballxtra-telegram-news.firebasestorage.app",
  messagingSenderId: "572364895604",
  appId: "1:572364895604:web:1a1051bbdb71e87610a821",
  measurementId: "G-DJBX3WKYFF"
};

const telegramNewsApp = initializeApp(
  telegramNewsConfig,
  "telegramNews"
);

const telegramNewsDb = getFirestore(telegramNewsApp);

export { telegramNewsApp, telegramNewsDb };

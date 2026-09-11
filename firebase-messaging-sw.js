importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCHyMeEhyjGbUXHd176W4kLQ6RiJ53IESU",
  authDomain: "footballxtra.firebaseapp.com",
  projectId: "footballxtra",
  storageBucket: "footballxtra.firebasestorage.app",
  messagingSenderId: "833152958281",
  appId: "1:833152958281:web:b299b100a897aa4de1a498"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const notificationTitle =
    payload.notification?.title || "FOOTBALLXTRA";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      "You have a new notification.",
    icon: "/icon-192.png",
    badge: "/icon-192.png"
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRtjv55QPF9hy4WdWuNUWg4eUOVWWGLXU",
  authDomain: "eb-tracker-vishalm01.firebaseapp.com",
  projectId: "eb-tracker-vishalm01",
  storageBucket: "eb-tracker-vishalm01.firebasestorage.app",
  messagingSenderId: "728384434311",
  appId: "1:728384434311:web:a3dd3652e0f0cb6e234822",
  measurementId: "G-6NK1XYVK25",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { firebaseConfig, app, db, auth };

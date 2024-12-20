// Use Firebase modules directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRtjv55QPF9hy4WdWuNUWg4eUOVWWGLXU",
  authDomain: "eb-tracker-vishalm01.firebaseapp.com",
  projectId: "eb-tracker-vishalm01",
  storageBucket: "eb-tracker-vishalm01.firebasestorage.app",
  messagingSenderId: "728384434311",
  appId: "1:728384434311:web:a3dd3652e0f0cb6e234822",
  measurementId: "G-6NK1XYVK25"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
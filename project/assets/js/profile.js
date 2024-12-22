import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const nameSpan = document.getElementById("name");
const emailSpan = document.getElementById("email");
const mobileSpan = document.getElementById("mobile");
const createdAtSpan = document.getElementById("createdAt");
const logoutText = document.getElementById("logoutButton");
const meternumber = document.getElementById("meternumber");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        nameSpan.textContent = userData.name || "N/A";
        emailSpan.textContent = user.email || "N/A";
        mobileSpan.textContent = "+91 " + userData.mobile || "N/A";
        meternumber.textContent = userData.meternumber || "N/A";
        createdAtSpan.textContent = userData.createdAt
        ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "N/A";
      } else {
        console.error("No user data found!");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  } else {
    window.location.href = "index.html";
  }
});

logoutText.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error logging out:", error);
  }
});

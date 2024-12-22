import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const mobile = document.getElementById("mobile").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const meternumber = document.getElementById("meternumber").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("User UID:", user.uid);
    const userDocRef = doc(db, "users", user.uid);
    console.log("User Doc Ref:", userDocRef.path);

    await setDoc(userDocRef, {
      name: name,
      mobile: mobile,
      email: email,
      meternumber: meternumber,
      createdAt: serverTimestamp(),
    });
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error signing up:", error);

    if (error.code === "auth/email-already-in-use") {
      alert("Error: The email address is already in use.");
    } else if (error.code === "firestore/permission-denied") {
      alert("Error: Missing or insufficient permissions.");
    } else {
      alert("Error signing up. Please try again.");
    }
  }
});

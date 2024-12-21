import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const signupForm = document.getElementById('signupForm');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Extract values from form fields
  const name = document.getElementById('name').value;
  const mobile = document.getElementById('mobile').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    // Create the user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('User UID:', user.uid); // Log User UID

    // Store user details in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    console.log('User Doc Ref:', userDocRef.path); // Log User Document Path

    await setDoc(userDocRef, {
      name: name,
      mobile: mobile,
      email: email,
      createdAt: serverTimestamp()
    });

    // Ensure Firestore sub-collection creation under user document
    const readingsCollectionRef = collection(userDocRef, 'readings');
    console.log('Sub-collection Readings:', readingsCollectionRef.path); // Log Sub-collection Path

    await addDoc(readingsCollectionRef, {
      value: 0, // Default reading value
      startingReading: true, // Indicates this is the starting reading
      date: serverTimestamp()
    });
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error signing up:", error);
    alert("Error signing up. Please try again.");
  }
});
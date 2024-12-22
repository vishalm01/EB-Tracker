import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;

function calculateBill(units) {
  let totalCost = 0;
  if (units <= 100) {
    totalCost = 0;
  } else if (units <= 200) {
    totalCost = (units - 100) * 2.35;
  } else if (units <= 400) {
    totalCost = 100 * 2.35 + (units - 200) * 4.7;
  } else if (units <= 500) {
    totalCost = 100 * 2.35 + 200 * 4.7 + (units - 400) * 6.3;
  } else if (units <= 600) {
    totalCost = 300 * 4.7 + 100 * 6.3 + (units - 500) * 8.4;
  } else if (units <= 800) {
    totalCost = 300 * 4.7 + 100 * 6.3 + 100 * 8.4 + (units - 600) * 9.45;
  } else if (units <= 1000) {
    totalCost =
      300 * 4.7 + 100 * 6.3 + 100 * 8.4 + 200 * 9.45 + (units - 800) * 10.5;
  } else {
    totalCost =
      300 * 4.7 +
      100 * 6.3 +
      100 * 8.4 +
      200 * 9.45 +
      200 * 10.5 +
      (units - 1000) * 11.55;
  }
  return totalCost.toFixed(2);
}

async function fetchReadings() {
  if (!currentUserUid) return [];
  try {
    const readingsRef = collection(db, "users", currentUserUid, "readings");
    const readingsQuery = query(readingsRef, orderBy("date", "asc"));
    const snapshot = await getDocs(readingsQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate().toISOString().split("T")[0],
    }));
  } catch (error) {
    console.error("Error fetching data from Firestore:", error);
    return [];
  }
}

async function populateReadingsTable() {
  const readingsTableBody = document.getElementById("readingsTableBody");
  if (!readingsTableBody) return;
  const readings = await fetchReadings();
  if (readings.length === 0) {
    readingsTableBody.innerHTML =
      "<tr><td colspan='6'>No readings available</td></tr>";
    return;
  }
  const startingReading = readings[0].value;
  readingsTableBody.innerHTML = readings
    .map((reading, index) => {
      const unitsUsed = (reading.value - startingReading).toFixed(2);
      const amount = index === 0 ? "N/A" : calculateBill(parseFloat(unitsUsed));
      return `
        <tr id="row-${reading.id}">
          <td>${reading.date}</td>
          <td id="reading-value-${reading.id}">${reading.value}</td>
          <td>${index === 0 ? "N/A" : unitsUsed}</td>
          <td>${index === 0 ? "N/A" : amount}</td>
          <td>
            <button class="btn btn-primary btn-md" onclick="editReading('${
              reading.id
            }', '${reading.value}')">
              <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="btn btn-danger btn-md m-1" onclick="deleteReading('${
              reading.id
            }')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function deleteReading(readingId) {
  try {
    await deleteDoc(doc(db, "users", currentUserUid, "readings", readingId));
    await populateReadingsTable();
  } catch (error) {
    console.error("Error deleting reading:", error);
  }
}

async function editReading(readingId, oldValue) {
  const newValue = prompt("Enter the new reading value:", oldValue);
  if (
    newValue === null ||
    isNaN(parseFloat(newValue)) ||
    parseFloat(newValue) <= 0
  ) {
    alert("Invalid value. Please enter a positive number.");
    return;
  }
  try {
    const readingRef = doc(db, "users", currentUserUid, "readings", readingId);
    await updateDoc(readingRef, { value: parseFloat(newValue) });
    await populateReadingsTable();
  } catch (error) {
    console.error("Error updating reading:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserUid = user.uid;
    populateReadingsTable();
  } else {
    window.location.href = "login.html";
  }
});

window.editReading = editReading;
window.deleteReading = deleteReading;

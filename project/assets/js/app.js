import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { collection, addDoc, getDocs, query, orderBy, Timestamp, writeBatch, doc, getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js"; // Ensure this path is correct

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;

// HTML Elements
const readingForm = document.getElementById("readingForm");
const currentReadingInput = document.getElementById("currentReading");
const lastReadingDisplay = document.getElementById("lastReading");
const unitsUsedDisplay = document.getElementById("unitsUsedDisplay");
const billAmountDisplay = document.getElementById("billAmountDisplay");
const usageChartCanvas = document.getElementById("usageChart");
const averageUsageDisplay = document.getElementById("averageUsage");
const estimatedTotalUnitsDisplay = document.getElementById("estimatedTotalUnits");
const estimatedPriceDisplay = document.getElementById("estimatedPrice");
const startingReadingDisplay = document.getElementById("startingReading");
const startingReadingSelector = document.getElementById("startingReadingSelector");
const updateStartingReadingButton = document.getElementById("updateStartingReading");

let usageChart;

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserUid = user.uid;
    loadReadingsIntoDropdown();
    refreshUI(); // Refresh the UI for the logged-in user
  } else {
    alert("You are not logged in. Redirecting to login...");
    window.location.href = "login.html";
  }
});

// Calculate the average usage based on the number of days between readings
function calculateAverageUsage(startingReading, lastReading) {
  // Convert Firestore Timestamps to JS Date objects if necessary
  const startDate = startingReading.date.toDate ? startingReading.date.toDate() : new Date(startingReading.date);
  const endDate = lastReading.date.toDate ? lastReading.date.toDate() : new Date(lastReading.date);

  // Check if dates are valid
  if (isNaN(startDate) || isNaN(endDate)) {
    console.error("Invalid dates in readings:", { startDate, endDate });
    return "N/A";
  }

  // Calculate the number of days between readings
  const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)); // Convert ms to days
  if (daysDifference <= 0) {
    console.error("Invalid days difference:", daysDifference);
    return "N/A";
  }

  // Calculate average usage
  const totalUnitsUsed = lastReading.value - startingReading.value;
  if (totalUnitsUsed <= 0) {
    console.error("Invalid total units used:", totalUnitsUsed);
    return "N/A";
  }

  const averageUsage = totalUnitsUsed / daysDifference;
  return averageUsage.toFixed(2);
}


// Estimate the total units for a 60-day period
function calculateEstimatedTotalUnits(averageUsage) {
  if (isNaN(averageUsage) || averageUsage <= 0) return "N/A";
  const estimatedTotalUnits = averageUsage * 60; // 60 days estimate
  return estimatedTotalUnits.toFixed(2);
}

// Calculate the bill amount based on estimated total units
function calculateBill(units) {
  if (isNaN(units) || units <= 0) return "N/A";
  
  const rates = [
    { limit: 100, rate: 0 },
    { limit: 200, rate: 2.35 },
    { limit: 400, rate: 4.70 },
    { limit: 500, rate: 6.30 },
    { limit: 600, rate: 8.40 },
    { limit: 800, rate: 9.45 },
    { limit: 1000, rate: 10.50 },
    { limit: Infinity, rate: 11.55 },
  ];

  let totalCost = 0;
  let previousLimit = 0;

  for (const { limit, rate } of rates) {
    if (units > previousLimit) {
      const diff = Math.min(units - previousLimit, limit - previousLimit);
      totalCost += diff * rate;
      previousLimit = limit;
    } else {
      break;
    }
  }

  return totalCost.toFixed(2);
}

// Fetch readings for the logged-in user
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
    console.error("Error fetching readings:", error);
    return [];
  }
}

// Find the starting reading by searching in reverse
function findStartingReading(readings) {
  for (let i = readings.length - 1; i >= 0; i--) {
    if (readings[i].startingReading) {
      return readings[i];
    }
  }
  return null; // Return null if no startingReading is found
}


// Load readings into the dropdown and set default to the current starting reading
async function loadReadingsIntoDropdown() {
  const readings = await fetchReadings();
  startingReadingSelector.innerHTML = ""; // Clear existing options

  let defaultStartingReadingId = null;

  // Populate the dropdown and find the current starting reading
  readings.forEach((reading) => {
    const option = document.createElement("option");
    option.value = reading.id; // Use Firestore document ID as the value
    option.textContent = `${reading.date} - ${reading.value} units`;

    if (reading.startingReading) {
      defaultStartingReadingId = reading.id; // Save the ID of the starting reading
    }

    startingReadingSelector.appendChild(option);
  });

  // Set the dropdown's default value to the current starting reading
  if (defaultStartingReadingId) {
    startingReadingSelector.value = defaultStartingReadingId;
  }
}

// Attach Event Listener to "Set as Starting Reading" Button with Debugging
updateStartingReadingButton.addEventListener("click", () => {
  updateStartingReading();
});

// Update the startingReading field in Firestore
async function updateStartingReading() {
  const selectedReadingId = startingReadingSelector.value;

  if (!selectedReadingId) {
    alert("Please select a starting reading.");
    return;
  }

  try {
    const readings = await fetchReadings();
    const selectedReadingIndex = readings.findIndex((reading) => reading.id === selectedReadingId);

    if (selectedReadingIndex === -1) {
      alert("Error: Selected reading not found.");
      return;
    }

    const selectedReadingDate = readings[selectedReadingIndex].date;

    // Firestore Batch Update
    const batch = writeBatch(db);
    const readingsRef = collection(db, "users", currentUserUid, "readings");

    readings.forEach((reading) => {
      const docRef = doc(readingsRef, reading.id);
      if (reading.id === selectedReadingId) {
        batch.update(docRef, { startingReading: true });
      } else if (new Date(reading.date) > new Date(selectedReadingDate) || reading.startingReading) {
        batch.update(docRef, { startingReading: false });
      }
    });

    await batch.commit();
    await refreshUI();
  } catch (error) {
    console.error("Error updating starting reading:", error);
    alert("Error updating starting reading. Please try again.");
  }
}

// Update the chart with new data
function updateChart(chart, labels, data) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

// Update the daily usage chart
function updateUsageChart(readings) {
  if (readings.length < 2) {
    usageChart.data.labels = [];
    usageChart.data.datasets[0].data = [];
    usageChart.update();
    return;
  }
  const deltas = readings.slice(1).map((r, i) => (r.value - readings[i].value).toFixed(2));
  const dates = readings.slice(1).map((r) => r.date);
  const isSmallScreen = window.innerWidth <= 768;
  const visibleDataCount = isSmallScreen ? 8 : 15;
  const start = Math.max(0, deltas.length - visibleDataCount);
  usageChart.data.labels = dates.slice(start);
  usageChart.data.datasets[0].data = deltas.slice(start);
  usageChart.update();
}

// Add new reading to the logged-in user's sub-collection
readingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Parse input as a float
  const value = parseFloat(currentReadingInput.value).toFixed(2); // Keep it as float with 2 decimal places
  if (isNaN(value) || value <= 0) {
    alert("Please enter a valid reading.");
    return;
  }
  if (!currentUserUid) {
    alert("Error: User is not logged in.");
    return;
  }

  try {
    const readingsRef = collection(db, "users", currentUserUid, "readings");
    await addDoc(readingsRef, {
      value: parseFloat(value), // Ensure the value is stored as float
      date: Timestamp.now(), // Current timestamp
      startingReading: false, // Default value for startingReading
    });
    await refreshUI(); // Refresh the UI after adding the reading
  } catch (error) {
    console.error("Error adding reading:", error);
  }
});

// Refresh the UI with the latest data
async function refreshUI() {
  const readings = await fetchReadings();

  if (readings.length === 0) {
    startingReadingDisplay.textContent = "N/A";
    lastReadingDisplay.textContent = "N/A";
    unitsUsedDisplay.textContent = "N/A";
    billAmountDisplay.textContent = "N/A";
    averageUsageDisplay.textContent = "N/A";
    estimatedTotalUnitsDisplay.textContent = "N/A";
    estimatedPriceDisplay.textContent = "N/A";
    return;
  }

  const lastReading = readings[readings.length - 1];
  const startingReading = findStartingReading(readings);

  if (startingReading) {
    const startingValue = parseFloat(startingReading.value).toFixed(2);
    const lastValue = parseFloat(lastReading.value).toFixed(2);
    const totalUnitsUsed = (lastValue - startingValue).toFixed(2);
    const averageUsage = calculateAverageUsage(startingReading, lastReading);
    const estimatedTotalUnits = calculateEstimatedTotalUnits(averageUsage);
    const estimatedPrice = calculateBill(estimatedTotalUnits);
    startingReadingDisplay.textContent = startingValue;
    lastReadingDisplay.textContent = lastValue;
    unitsUsedDisplay.textContent = totalUnitsUsed;
    billAmountDisplay.textContent = calculateBill(totalUnitsUsed);
    averageUsageDisplay.textContent = averageUsage;
    estimatedTotalUnitsDisplay.textContent = estimatedTotalUnits;
    estimatedPriceDisplay.textContent = estimatedPrice;
  }
}


// Initialize charts
function initializeCharts() {
  usageChart = initializeChart(usageChartCanvas, "Daily Usage");
}

// Initialize a chart
function initializeChart(canvas, label) {
  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          backgroundColor: "rgba(30, 144, 255, 0.1)",
          borderColor: "#1E90FF",
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { weight: "bold", size: 14 },
            color: "#FFFFFF",
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "PERIOD", font: { size: 14 }, color: "#FFFFFF" },
          ticks: { font: { size: 12 }, color: "#FFFFFF" },
        },
        y: {
          title: { display: true, text: "USAGE", font: { size: 14 }, color: "#FFFFFF" },
          ticks: { font: { weight: "bold", size: 12 }, color: "#FFFFFF" },
          beginAtZero: true,
        },
      },
    },
  });
}

// Initialize the app
(async () => {
  initializeCharts();
})();
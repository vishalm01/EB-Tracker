import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  doc,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;

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

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserUid = user.uid;
    loadReadingsIntoDropdown();
    refreshUI();
  } else {
    window.location.href = "login.html";
  }
});

function calculateAverageUsage(startingReading, lastReading) {
  const startDate = new Date(startingReading.date);
  const endDate = new Date(lastReading.date);
  const daysDifference = (endDate - startDate) / (1000 * 60 * 60 * 24);
  if (daysDifference === 0) return "N/A";
  const totalUnitsUsed = lastReading.value - startingReading.value;
  const averageUsage = totalUnitsUsed / daysDifference;
  return averageUsage.toFixed(2);
}


function calculateEstimatedTotalUnits(averageUsage) {
  if (!averageUsage || averageUsage === "N/A") return "N/A";
  const estimatedTotalUnits = averageUsage * 60;
  return estimatedTotalUnits.toFixed(2);
}

function calculateBill(units) {
  const rates = [
    { limit: 100, rate: 0 },
    { limit: 200, rate: 2.35 },
    { limit: 400, rate: 4.7 },
    { limit: 500, rate: 6.3 },
    { limit: 600, rate: 8.4 },
    { limit: 800, rate: 9.45 },
    { limit: 1000, rate: 10.5 },
    { limit: Infinity, rate: 11.55 },
  ];
  let totalCost = 0,
    previousLimit = 0;
  for (const { limit, rate } of rates) {
    if (units > previousLimit) {
      const diff = Math.min(units - previousLimit, limit - previousLimit);
      totalCost += diff * rate;
      previousLimit = limit;
    } else break;
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
    console.error("Error fetching readings:", error);
    return [];
  }
}

function findStartingReading(readings) {
  for (let i = readings.length - 1; i >= 0; i--) {
    if (readings[i].startingReading) {
      return readings[i];
    }
  }
  return null;
}

async function loadReadingsIntoDropdown() {
  const readings = await fetchReadings();
  startingReadingSelector.innerHTML = "";
  let defaultStartingReadingId = null;
  readings.forEach((reading) => {
    const option = document.createElement("option");
    option.value = reading.id;
    option.textContent = `${reading.date} - ${reading.value} units`;
    if (reading.startingReading) {
      defaultStartingReadingId = reading.id;
    }
    startingReadingSelector.appendChild(option);
  });
  if (defaultStartingReadingId) {
    startingReadingSelector.value = defaultStartingReadingId;
  }
}

updateStartingReadingButton.addEventListener("click", () => {
  updateStartingReading();
});

async function updateStartingReading() {
  const selectedReadingId = startingReadingSelector.value;
  if (!selectedReadingId) {
    alert("Please select a starting reading.");
    return;
  }
  try {
    const readings = await fetchReadings();
    const selectedReadingIndex = readings.findIndex(
      (reading) => reading.id === selectedReadingId
    );
    if (selectedReadingIndex === -1) {
      alert("Error: Selected reading not found.");
      return;
    }
    const selectedReadingDate = readings[selectedReadingIndex].date;
    const batch = writeBatch(db);
    const readingsRef = collection(db, "users", currentUserUid, "readings");
    readings.forEach((reading) => {
      const docRef = doc(readingsRef, reading.id);
      if (reading.id === selectedReadingId) {
        batch.update(docRef, { startingReading: true });
      } else if (
        new Date(reading.date) > new Date(selectedReadingDate) ||
        reading.startingReading
      ) {
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

function updateChart(chart, labels, data) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

function updateUsageChart(readings) {
  if (readings.length < 2) {
    usageChart.data.labels = [];
    usageChart.data.datasets[0].data = [];
    usageChart.update();
    return;
  }
  const deltas = [];
  const dates = [];
  for (let i = 1; i < readings.length; i++) {
    const currentReading = readings[i];
    const previousReading = readings[i - 1];
    const currentDate = new Date(currentReading.date);
    const previousDate = new Date(previousReading.date);
    const daysDifference = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
    if (daysDifference === 1) {
      const delta = (currentReading.value - previousReading.value).toFixed(2);
      deltas.push(delta);
      dates.push(formatDate(currentDate));
    } else {
      const averageUsage = (
        (currentReading.value - previousReading.value) /
        daysDifference
      ).toFixed(2);
      for (let j = 1; j <= daysDifference; j++) {
        const interpolatedDate = new Date(previousDate);
        interpolatedDate.setDate(previousDate.getDate() + j);
        deltas.push(averageUsage);
        dates.push(formatDate(interpolatedDate));
      }
    }
  }
  const isSmallScreen = window.innerWidth <= 768;
  const visibleDataCount = isSmallScreen ? 7 : 16;
  const start = Math.max(0, deltas.length - visibleDataCount);
  usageChart.data.labels = dates.slice(start, start + visibleDataCount);
  usageChart.data.datasets[0].data = deltas.slice(
    start,
    start + visibleDataCount
  );
  usageChart.update();
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}`;
}

readingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = parseFloat(currentReadingInput.value).toFixed(2);
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
    const readingsQuery = query(readingsRef, orderBy("date", "desc"));
    const readingsSnapshot = await getDocs(readingsQuery);
    const isFirstReading = readingsSnapshot.empty;
    const lastReadingDoc = readingsSnapshot.docs[0];
    const lastReadingValue = lastReadingDoc ? lastReadingDoc.data().value : 0;
    if (parseFloat(value) <= lastReadingValue) {
      alert(
        `The input reading must be greater than the last reading of ${lastReadingValue}.`
      );
      return;
    }
    await addDoc(readingsRef, {
      value: parseFloat(value),
      date: Timestamp.now(),
      startingReading: isFirstReading,
    });
    currentReadingInput.value = "";
    await refreshUI();
    await loadReadingsIntoDropdown();
  } catch (error) {
    console.error("Error adding reading:", error);
    alert("Error adding reading. Please try again.");
  }
});

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

    if (averageUsage === "N/A") {
      averageUsageDisplay.textContent = "N/A";
      estimatedTotalUnitsDisplay.textContent = "N/A";
      estimatedPriceDisplay.textContent = "N/A";
    } else {
      const estimatedTotalUnits = calculateEstimatedTotalUnits(averageUsage);
      const estimatedPrice = calculateBill(estimatedTotalUnits);

      averageUsageDisplay.textContent = averageUsage;
      estimatedTotalUnitsDisplay.textContent = estimatedTotalUnits;
      estimatedPriceDisplay.textContent = estimatedPrice;
    }

    startingReadingDisplay.textContent = startingValue;
    lastReadingDisplay.textContent = lastValue;
    unitsUsedDisplay.textContent = totalUnitsUsed;
    billAmountDisplay.textContent = calculateBill(totalUnitsUsed);
  } else {
    startingReadingDisplay.textContent = "N/A";
    lastReadingDisplay.textContent = parseFloat(lastReading.value).toFixed(2);
    unitsUsedDisplay.textContent = "N/A";
    billAmountDisplay.textContent = "N/A";
    averageUsageDisplay.textContent = "N/A";
    estimatedTotalUnitsDisplay.textContent = "N/A";
    estimatedPriceDisplay.textContent = "N/A";
  }

  updateUsageChart(readings);
}

function initializeCharts() {
  usageChart = initializeChart(usageChartCanvas, "Daily Usage");
}

function initializeChart(canvas, label) {
  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          backgroundColor: "rgba(30, 144, 255, 0.2)",
          borderColor: "#1E90FF",
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { weight: "bold", size: 14 },
            color: "#fff",
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "DATE",
            font: { size: 14 },
            color: "#fff",
          },
          ticks: {
            font: { size: 12 },
            color: "#fff",
            callback: function (value, index, values) {
              return this.getLabelForValue(value);
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "USAGE",
            font: { size: 14 },
            color: "#fff",
          },
          ticks: {
            font: { weight: "bold", size: 12 },
            color: "#fff",
            callback: function (value) {
              return Number.isInteger(value) ? value : null;
            },
          },
          beginAtZero: true,
        },
      },
    },
  });
}

(async () => {
  initializeCharts();
})();

import { collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const readingForm = document.getElementById("readingForm");
const currentReadingInput = document.getElementById("currentReading");
const lastReadingDisplay = document.getElementById("lastReading");
const unitsUsedDisplay = document.getElementById("unitsUsedDisplay");
const billAmountDisplay = document.getElementById("billAmountDisplay");
const readingsTableBody = document.getElementById("readingsTableBody");
const usageChartCanvas = document.getElementById("usageChart");
const weeklyChartCanvas = document.getElementById("weeklyUsageChart");

let usageChart, weeklyChart;

function calculateBill(units) {
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
  let totalCost = 0, previousLimit = 0;
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
  try {
    const readingsRef = collection(db, "readings");
    const readingsQuery = query(readingsRef, orderBy("date", "asc"));
    const snapshot = await getDocs(readingsQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate().toISOString().split("T")[0],
    }));
  } catch (error) {
    console.error('Error fetching readings:', error);
    return [];
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
  const deltas = readings.slice(1).map((r, i) => (r.value - readings[i].value).toFixed(2));
  const dates = readings.slice(1).map((r) => r.date);
  const isSmallScreen = window.innerWidth <= 768;
  const visibleDataCount = isSmallScreen ? 8 : 15;
  const start = Math.max(0, deltas.length - visibleDataCount);
  usageChart.data.labels = dates.slice(start);
  usageChart.data.datasets[0].data = deltas.slice(start);
  usageChart.update();
}

function updateWeeklyChart(readings, month) {
  const filteredReadings = readings.filter((reading) => {
    const readingDate = new Date(reading.date);
    return readingDate.getMonth() + 1 === month;
  });
  const weeklySums = [];
  let currentWeekSum = 0;
  let currentWeek = 1;
  filteredReadings.forEach((reading, index) => {
    const dayOfWeek = new Date(reading.date).getDay();
    if (index > 0) {
      currentWeekSum += reading.value - filteredReadings[index - 1].value;
    }
    if (dayOfWeek === 6 || index === filteredReadings.length - 1) {
      weeklySums.push({ week: `Week ${currentWeek}`, sum: currentWeekSum });
      currentWeekSum = 0;
      currentWeek++;
    }
  });
  const limitedWeeklySums = weeklySums.slice(0, 4);
  const labels = limitedWeeklySums.map((week) => week.week);
  const data = limitedWeeklySums.map((week) => week.sum);
  updateChart(weeklyChart, labels, data);
}

document.getElementById('monthSelector').addEventListener('change', async (e) => {
  const selectedMonth = parseInt(e.target.value, 10);
  const readings = await fetchReadings();
  updateWeeklyChart(readings, selectedMonth);
});

document.addEventListener('DOMContentLoaded', async () => {
  const currentMonth = new Date().getMonth() + 1;
  const readings = await fetchReadings();
  updateWeeklyChart(readings, currentMonth);
});

const monthDropdown = document.getElementById('monthSelector');
monthDropdown.innerHTML = Array.from({ length: 12 }, (_, i) =>
  `<option value="${i + 1}">${new Date(0, i).toLocaleString('en', { month: 'long' })}</option>`
).join("");

monthDropdown.addEventListener('change', async (e) => {
  const selectedMonth = parseInt(e.target.value, 10);
  const readings = await fetchReadings();
  updateWeeklyChart(readings, selectedMonth);
});

const currentMonth = new Date().getMonth() + 1;
monthDropdown.value = currentMonth;
monthDropdown.dispatchEvent(new Event('change'));

function calculateAverageUsage(readings) {
  if (readings.length < 2) return "N/A";
  const dailyDeltas = readings.slice(1).map((reading, i) => {
    const difference = reading.value - readings[i].value;
    return difference > 0 ? difference : 0;
  });
  const totalUsage = dailyDeltas.reduce((sum, delta) => sum + delta, 0);
  const average = totalUsage / dailyDeltas.length;
  return average.toFixed(2);
}

function initializeCharts() {
  usageChart = initializeChart(usageChartCanvas, "Daily Usage");
  weeklyChart = initializeChart(weeklyChartCanvas, "Weekly Usage");
}

function initializeChart(canvas, label) {
  return new Chart(canvas.getContext("2d"), {
    type: label === "Daily Usage" ? "line" : "bar",
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        backgroundColor: "rgba(30, 144, 255, 0.1)",
        borderColor: "#1E90FF",
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { weight: 'bold', size: 14 },
            color: "#FFFFFF",
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "PERIOD", font: { size: 14 }, color: "#FFFFFF" },
          ticks: {
            font: { size: 12 },
            color: "#FFFFFF",
            callback: function (value) {
              const date = this.getLabelForValue(value);
              return date.split("-").reverse().slice(0, 2).join("-");
            },
          },
        },
        y: {
          title: { display: true, text: "USAGE", font: { size: 14 }, color: "#FFFFFF" },
          ticks: { font: { weight: 'bold', size: 12 }, color: "#FFFFFF" },
          beginAtZero: true,
        },
      },
    },
  });
}

async function refreshUI() {
  const readings = await fetchReadings();
  updateUsageChart(readings);
  const currentMonth = new Date().getMonth() + 1;
  updateWeeklyChart(readings, currentMonth);
  const averageUsage = calculateAverageUsage(readings);
  document.getElementById("averageUsage").textContent = averageUsage;
  if (averageUsage !== "N/A") {
    const estimatedUnits = averageUsage * 64;
    const estimatedAmount = calculateBill(estimatedUnits);
    document.getElementById("estimatedTotalUnits").textContent = estimatedUnits.toFixed(2);
    document.getElementById("estimatedPrice").textContent = estimatedAmount;
  } else {
    document.getElementById("estimatedTotalUnits").textContent = "N/A";
    document.getElementById("estimatedPrice").textContent = "N/A";
  }
  if (readings.length > 0) {
    const startingReading = readings[0].value;
    const lastReading = readings[readings.length - 1].value;
    const unitsUsed = (lastReading - startingReading).toFixed(2);
    const amount = calculateBill(unitsUsed);
    document.getElementById("startingReading").textContent = startingReading;
    lastReadingDisplay.textContent = lastReading;
    unitsUsedDisplay.textContent = unitsUsed;
    billAmountDisplay.textContent = amount;
  } else {
    document.getElementById("startingReading").textContent = "N/A";
    lastReadingDisplay.textContent = "N/A";
    unitsUsedDisplay.textContent = "N/A";
    billAmountDisplay.textContent = "N/A";
  }
}

readingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = parseFloat(currentReadingInput.value);
  if (isNaN(value) || value <= 0) {
    alert("Please enter a valid reading.");
    return;
  }
  await addDoc(collection(db, "readings"), { value, date: Timestamp.now() });
  await refreshUI();
});

(async () => {
  initializeCharts();
  await refreshUI();
})();

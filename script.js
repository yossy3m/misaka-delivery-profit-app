"use strict";

const vehicleMaster = [
  { id: "large10t-200", label: "大型10t 200", plate: "200", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-201", label: "大型10t 201", plate: "201", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-202", label: "大型10t 202", plate: "202", type: "大型10t", fuelEfficiency: 3 },
  { id: "4t-202", label: "4t 202", plate: "202", type: "4t", fuelEfficiency: 5 },
  { id: "large10t-203", label: "大型10t 203", plate: "203", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-204", label: "大型10t 204", plate: "204", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-205", label: "大型10t 205", plate: "205", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-207", label: "大型10t 207", plate: "207", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-208", label: "大型10t 208", plate: "208", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-209", label: "大型10t 209", plate: "209", type: "大型10t", fuelEfficiency: 3 },
  { id: "trailer-210", label: "トレーラー 210", plate: "210", type: "トレーラー", fuelEfficiency: 2.5 },
  { id: "large10t-220", label: "大型10t 220", plate: "220", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-230", label: "大型10t 230", plate: "230", type: "大型10t", fuelEfficiency: 3 },
  { id: "large10t-240", label: "大型10t 240", plate: "240", type: "大型10t", fuelEfficiency: 3 }
];

const elements = {
  origin: document.querySelector("#origin"),
  pickup: document.querySelector("#pickup"),
  destination: document.querySelector("#destination"),
  roundTrip: document.querySelector("#roundTrip"),
  vehicle: document.querySelector("#vehicle"),
  vehicleType: document.querySelector("#vehicleType"),
  fetchRoute: document.querySelector("#fetchRoute"),
  buttonLabel: document.querySelector(".button-label"),
  status: document.querySelector("#status"),
  distance: document.querySelector("#distance"),
  duration: document.querySelector("#duration"),
  toll: document.querySelector("#toll"),
  fuelEfficiency: document.querySelector("#fuelEfficiency"),
  fuelPrice: document.querySelector("#fuelPrice"),
  sales: document.querySelector("#sales"),
  loadingMinutes: document.querySelector("#loadingMinutes"),
  unloadingMinutes: document.querySelector("#unloadingMinutes"),
  waitingMinutes: document.querySelector("#waitingMinutes"),
  laborHourlyRate: document.querySelector("#laborHourlyRate"),
  fuelCost: document.querySelector("#fuelCost"),
  tollCost: document.querySelector("#tollCost"),
  laborCost: document.querySelector("#laborCost"),
  totalCost: document.querySelector("#totalCost"),
  restraintDuration: document.querySelector("#restraintDuration"),
  profit: document.querySelector("#profit"),
  profitPanel: document.querySelector("#profitPanel"),
  saveHistory: document.querySelector("#saveHistory"),
  historyStatus: document.querySelector("#historyStatus"),
  emptyHistory: document.querySelector("#emptyHistory"),
  historyList: document.querySelector("#historyList")
};

const HISTORY_STORAGE_KEY = "misakaDeliveryProfitHistory";
let routeDurationMinutes = 0;

const calculationInputs = [
  elements.distance,
  elements.toll,
  elements.fuelEfficiency,
  elements.fuelPrice,
  elements.sales,
  elements.loadingMinutes,
  elements.unloadingMinutes,
  elements.waitingMinutes,
  elements.laborHourlyRate
];

function populateVehicleOptions() {
  const options = vehicleMaster.map((vehicle) => {
    const option = document.createElement("option");
    option.value = vehicle.id;
    option.textContent = vehicle.label;
    return option;
  });

  elements.vehicle.append(...options);
}

function handleVehicleChange() {
  const selectedVehicle = vehicleMaster.find(
    (vehicle) => vehicle.id === elements.vehicle.value
  );

  if (!selectedVehicle) {
    elements.vehicleType.textContent = "未選択";
    return;
  }

  elements.vehicleType.textContent = selectedVehicle.type;
  elements.fuelEfficiency.value = String(selectedVehicle.fuelEfficiency);
  calculateProfit();
}

function readNumber(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : 0;
}

function formatYen(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatDuration(durationText) {
  const totalMinutes = durationToMinutes(durationText);

  if (totalMinutes === null) {
    return "未取得";
  }

  return formatMinutes(totalMinutes);
}

function durationToMinutes(durationText) {
  const seconds = Number.parseFloat(String(durationText).replace("s", ""));
  return Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null;
}

function formatMinutes(totalMinutes) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return hours > 0 ? `${hours}時間 ${minutes}分` : `${minutes}分`;
}

function calculateProfit() {
  const distance = readNumber(elements.distance);
  const toll = readNumber(elements.toll);
  const fuelEfficiency = readNumber(elements.fuelEfficiency);
  const fuelPrice = readNumber(elements.fuelPrice);
  const sales = readNumber(elements.sales);
  const loadingMinutes = readNumber(elements.loadingMinutes);
  const unloadingMinutes = readNumber(elements.unloadingMinutes);
  const waitingMinutes = readNumber(elements.waitingMinutes);
  const laborHourlyRate = readNumber(elements.laborHourlyRate);

  const fuelCost =
    distance > 0 && fuelEfficiency > 0 && fuelPrice > 0
      ? (distance / fuelEfficiency) * fuelPrice
      : 0;
  const restraintMinutes =
    routeDurationMinutes +
    loadingMinutes +
    unloadingMinutes +
    waitingMinutes;
  const laborCost = (restraintMinutes / 60) * laborHourlyRate;
  const totalCost = fuelCost + toll + laborCost;
  const profit = sales - totalCost;

  elements.fuelCost.textContent = formatYen(fuelCost);
  elements.tollCost.textContent = formatYen(toll);
  elements.laborCost.textContent = formatYen(laborCost);
  elements.totalCost.textContent = formatYen(totalCost);
  elements.restraintDuration.textContent = formatMinutes(restraintMinutes);
  elements.profit.textContent = formatYen(profit);
  elements.profitPanel.classList.toggle("negative", profit < 0);

  return {
    distance,
    toll,
    fuelCost,
    laborCost,
    totalCost,
    profit,
    restraintMinutes
  };
}

function loadHistory() {
  try {
    const savedHistory = JSON.parse(
      localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"
    );
    return Array.isArray(savedHistory) ? savedHistory : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function formatHistoryDate(isoDate) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function createHistoryDetail(label, value, className = "") {
  const detail = document.createElement("div");
  detail.className = `history-detail ${className}`.trim();

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  detail.append(labelElement, valueElement);
  return detail;
}

function deleteHistory(id) {
  const updatedHistory = loadHistory().filter((item) => item.id !== id);
  writeHistory(updatedHistory);
  renderHistory();
  elements.historyStatus.textContent = "履歴を削除しました。";
}

function renderHistory() {
  const history = loadHistory();
  elements.historyList.replaceChildren();
  elements.emptyHistory.hidden = history.length > 0;

  history.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-card";

    const header = document.createElement("div");
    header.className = "history-card-header";

    const vehicle = document.createElement("strong");
    vehicle.textContent = item.vehicle || "車両未選択";

    const date = document.createElement("time");
    date.dateTime = item.date;
    date.textContent = formatHistoryDate(item.date);
    header.append(vehicle, date);

    const details = document.createElement("div");
    details.className = "history-details";
    details.append(
      createHistoryDetail("出発地", item.origin || "－"),
      createHistoryDetail("集荷地", item.pickup || "－"),
      createHistoryDetail("配送先", item.destination || "－"),
      createHistoryDetail("往復", item.roundTrip ? "あり" : "なし"),
      createHistoryDetail("距離", `${item.distance.toLocaleString("ja-JP")} km`),
      createHistoryDetail("所要時間", item.duration || "未取得"),
      createHistoryDetail("高速料金", formatYen(item.toll)),
      createHistoryDetail("燃料費", formatYen(item.fuelCost)),
      createHistoryDetail("人件費", formatYen(item.laborCost)),
      createHistoryDetail("経費合計", formatYen(item.totalCost)),
      createHistoryDetail("最終利益", formatYen(item.profit), "final-profit")
    );

    const footer = document.createElement("div");
    footer.className = "history-card-footer";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-history";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute(
      "aria-label",
      `${formatHistoryDate(item.date)}の履歴を削除`
    );
    deleteButton.addEventListener("click", () => deleteHistory(item.id));
    footer.append(deleteButton);

    card.append(header, details, footer);
    elements.historyList.append(card);
  });
}

function saveCurrentHistory() {
  const selectedVehicle = vehicleMaster.find(
    (vehicle) => vehicle.id === elements.vehicle.value
  );
  const calculation = calculateProfit();

  if (!elements.origin.value.trim() || !elements.destination.value.trim()) {
    elements.historyStatus.textContent =
      "出発地と配送先を入力してから保存してください。";
    return;
  }

  if (calculation.distance <= 0) {
    elements.historyStatus.textContent =
      "距離を取得または入力してから保存してください。";
    return;
  }

  const historyItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    vehicle: selectedVehicle?.label || "車両未選択",
    vehicleId: selectedVehicle?.id || "",
    origin: elements.origin.value.trim(),
    pickup: elements.pickup.value.trim(),
    destination: elements.destination.value.trim(),
    roundTrip: elements.roundTrip.checked,
    distance: calculation.distance,
    duration: elements.duration.textContent,
    toll: calculation.toll,
    fuelCost: calculation.fuelCost,
    laborCost: calculation.laborCost,
    totalCost: calculation.totalCost,
    profit: calculation.profit
  };
  const history = loadHistory();
  history.unshift(historyItem);
  writeHistory(history);
  renderHistory();
  elements.historyStatus.textContent = "計算結果を履歴に保存しました。";
}

function showStatus(message, type = "info") {
  elements.status.hidden = false;
  elements.status.className = `status ${type}`;
  elements.status.textContent = message;
}

function clearStatus() {
  elements.status.hidden = true;
  elements.status.textContent = "";
}

function setLoading(isLoading) {
  elements.fetchRoute.disabled = isLoading;
  elements.fetchRoute.classList.toggle("loading", isLoading);
  elements.buttonLabel.textContent = isLoading
    ? "Google Mapsから取得中..."
    : "距離・時間・高速料金を取得";
}

function validateRouteForm() {
  if (!elements.origin.value.trim()) {
    throw new Error("出発地を入力してください。");
  }

  if (!elements.destination.value.trim()) {
    throw new Error("配送先を入力してください。");
  }
}

async function handleFetchRoute() {
  clearStatus();

  try {
    validateRouteForm();
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }

  setLoading(true);

  try {
    showStatus("距離・所要時間・高速料金を取得しています...");
    const response = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        origin: elements.origin.value.trim(),
        pickup: elements.pickup.value.trim(),
        destination: elements.destination.value.trim(),
        roundTrip: elements.roundTrip.checked
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "ルートを取得できませんでした。");
    }

    elements.distance.value = (data.distanceMeters / 1000).toFixed(1);
    routeDurationMinutes = durationToMinutes(data.duration) ?? 0;
    elements.duration.textContent = formatDuration(data.duration);

    if (data.tollYen === null) {
      elements.toll.value = "0";
      showStatus(
        "ルートを取得しました。Googleから高速料金が返されなかったため、高速料金は0円にしています。必要に応じて手入力してください。",
        "success"
      );
    } else {
      elements.toll.value = String(Math.round(data.tollYen));
      const outboundDescription = data.pickupAddress
        ? `${data.originAddress} → ${data.pickupAddress} → ${data.destinationAddress}`
        : `${data.originAddress} → ${data.destinationAddress}`;
      const routeDescription = data.roundTrip
        ? `${outboundDescription} → ${data.originAddress}`
        : outboundDescription;
      showStatus(
        `${routeDescription} のルートを取得しました。`,
        "success"
      );
    }

    calculateProfit();
  } catch (error) {
    const message =
      location.protocol === "file:"
        ? "このアプリはファイルを直接開けません。READMEの手順どおりnpm startで起動してください。"
        : error.message || "ルートの取得中にエラーが発生しました。";
    showStatus(message, "error");
  } finally {
    setLoading(false);
  }
}

elements.fetchRoute.addEventListener("click", handleFetchRoute);
elements.vehicle.addEventListener("change", handleVehicleChange);
elements.saveHistory.addEventListener("click", saveCurrentHistory);

calculationInputs.forEach((input) => {
  input.addEventListener("input", calculateProfit);
});

populateVehicleOptions();
calculateProfit();
renderHistory();

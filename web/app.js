"use strict";

const get = id => document.getElementById(id);
const show = (id, value) => { get(id).textContent = value; };
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const money = paise => rupees.format(paise / 100);
let replay;
let setup;
let chartEnd = null;
let inspectedDate;
let drag;
let chartTool = "pan";
let drawingGeometry;
const drawingTools = document.querySelectorAll("[data-tool]");

let busy = false;

async function api(path, body) {
  const response = await fetch("/api/" + path, body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(typeof result.detail === "string" ? result.detail : "Check your inputs and try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

function setControls() {
  const done = !replay || replay.index === replay.end;
  for (const id of ["restart", "challenge"]) get(id).disabled = busy;
  get("restart").disabled = busy || !get("start").value;
  get("challenge").disabled = busy || !get("stock").value;
  get("next").disabled = busy || done;
  if (!replay) {
    get("zoom-in").disabled = true;
    get("zoom-out").disabled = true;
  }
  get("cancel").disabled = busy;
  for (const button of get("trade").querySelectorAll("button")) {
    button.disabled = busy || done || Boolean(replay?.pending);
  }
}

async function run(work) {
  if (busy) return;
  busy = true;
  setControls();
  show("message", "");
  try {
    const updated = await work();
    if (updated.id !== replay?.id) {
      chartEnd = null;
      inspectedDate = null;
      chooseTool("pan");
    }
    replay = updated;
    localStorage.setItem("papertrade-session", replay.id);
    render();
  } catch (error) {
    show("message", error.message);
  } finally {
    busy = false;
    setControls();
  }
}

function estimate() {
  if (!replay) return;
  const quantity = get("quantity").valueAsNumber;
  const amount = Math.round(Number(replay.candles.at(-1).close) * 100) * quantity;
  show("estimate", quantity > 0 ? "At current close: " + money(amount) : "");
}

function render() {
  const close = Number(replay.candles.at(-1).close);
  const pnl = replay.value - replay.starting_cash;
  show("company", setup.stocks.find(stock => stock.symbol === replay.symbol).name);
  show("market-label", "NSE · " + replay.symbol + " · Daily prices");
  show("quote", money(Math.round(close * 100)));
  show("value", money(replay.value));
  show("cash", money(replay.cash));
  show("shares", replay.shares);
  show("pnl", money(pnl));
  get("pnl").className = pnl > 0 ? "gain" : pnl < 0 ? "loss" : "";
  show("date", replay.date);
  const elapsed = replay.index - replay.start;
  const sessions = replay.end - replay.start;
  const mode = replay.challenge ? "Challenge" : "Replay";
  show("progress", elapsed === sessions ? mode + " complete" : mode + " · " + elapsed + " of " + sessions + " sessions advanced");
  show("pending", replay.pending
    ? "Queued: " + replay.pending.side + " " + replay.pending.quantity + " shares"
    : "");
  get("cancel").hidden = !replay.pending;
  show("benchmark", money(replay.benchmark));
  const difference = replay.value - replay.benchmark;
  show("difference", difference === 0 ? "Even with benchmark"
    : money(Math.abs(difference)) + (difference > 0 ? " ahead of benchmark" : " behind benchmark"));
  const tbody = get("trades");
  tbody.replaceChildren();
  if (!replay.trades.length) {
    const cell = tbody.insertRow().insertCell();
    cell.colSpan = 5;
    cell.textContent = "No executed or rejected orders yet.";
  }
  for (const trade of [...replay.trades].reverse()) {
    const row = tbody.insertRow();
    const status = trade.reason ? "Rejected · " + trade.reason : "Filled";
    for (const value of [trade.date, trade.side.toUpperCase(), trade.quantity, money(trade.price), status]) {
      row.insertCell().textContent = value;
    }
  }
  estimate();
  drawChart();
}

function candlePattern(rows, index) {
  const { open, high, low, close } = numbers(rows[index]);
  const body = Math.abs(close - open);
  const range = high - low;
  if (!range) return "";
  if (body <= range * 0.1) return "Doji";
  if (Math.min(open, close) - low >= 2 * body && high - Math.max(open, close) <= body * 0.5) {
    return "Hammer shape";
  }
  if (index > 0) {
    const previous = numbers(rows[index - 1]);
    if (close > open && previous.close < previous.open && open <= previous.close && close >= previous.open) {
      return "Bullish engulfing";
    }
    if (close < open && previous.close > previous.open && open >= previous.close && close <= previous.open) {
      return "Bearish engulfing";
    }
  }
  return "";
}

function numbers(row) {
  return { open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close) };
}

function showCandle() {
  const index = replay.candles.findIndex(row => row.date === get("inspect-date").value);
  if (index < 0) return;
  const { open, high, low, close } = numbers(replay.candles[index]);
  const pattern = candlePattern(replay.candles, index);
  const price = value => money(Math.round(value * 100));
  show("ohlc", `O ${price(open)} · H ${price(high)} · L ${price(low)} · C ${price(close)}${pattern ? " · " + pattern : ""}`);
}

function drawChart() {
  if (!replay) return;
  const canvas = get("chart");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const count = Number(get("window").value);
  const latest = replay.candles.length;
  const earliest = Math.min(count, latest);
  const end = Math.max(earliest, Math.min(chartEnd ?? latest, latest));
  const candles = replay.candles.slice(Math.max(0, end - count), end);
  const slider = get("history-window");
  slider.min = earliest;
  slider.max = latest;
  slider.value = end;
  slider.disabled = earliest === latest;
  show("chart-range", candles[0].date + " to " + candles.at(-1).date);
  const inspect = get("inspect-date");
  inspect.replaceChildren(...candles.map(row => new Option(row.date, row.date)));
  inspect.value = candles.some(row => row.date === inspectedDate) ? inspectedDate : candles.at(-1).date;
  showCandle();

  const lineMode = get("chart-mode").value === "line";
  const values = candles.map(numbers);
  const bottom = height - 28;
  const left = 60;
  const right = width - 14;
  const slot = (right - left) / values.length;
  const low = Math.min(...values.map(row => lineMode ? row.close : row.low));
  const high = Math.max(...values.map(row => lineMode ? row.close : row.high));
  const padding = Math.max(1, (high - low) * .12);
  const min = low - padding;
  const max = high + padding;
  const x = index => left + slot * (index + .5);
  const y = price => bottom - (bottom - 18) * (price - min) / (max - min);
  drawingGeometry = { candles, left, right, bottom, slot, min, max };
  get("zoom-in").disabled = count <= 10;
  get("zoom-out").disabled = count >= 320 || count >= latest;
  const drawings = readDrawings();
  get("undo-line").disabled = drawings.length === 0;


  ctx.font = "12px Segoe UI";
  ctx.fillStyle = "#4e6667";
  ctx.strokeStyle = "#d9e5e1";
  for (let tick = 0; tick <= 4; tick++) {
    const price = min + (max - min) * tick / 4;
    const line = y(price);
    ctx.fillText("₹" + price.toFixed(0), 4, line + 4);
    ctx.beginPath();
    ctx.moveTo(left, line);
    ctx.lineTo(right, line);
    ctx.stroke();
  }
  ctx.fillText(candles[0].date, left, height - 5);
  if (candles.length > 1 && width > 235) {
    ctx.textAlign = "right";
    ctx.fillText(candles.at(-1).date, right, height - 5);
    ctx.textAlign = "left";
  }
  if (lineMode) {
    ctx.strokeStyle = "#08634e";
    ctx.fillStyle = "#08634e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((row, index) => {
      if (index === 0) ctx.moveTo(x(index), y(row.close));
      else ctx.lineTo(x(index), y(row.close));
    });
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x(values.length - 1), y(values.at(-1).close), 3, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    const bodyWidth = Math.min(14, slot * .65);
    values.forEach((row, index) => {
      ctx.fillStyle = ctx.strokeStyle = row.close >= row.open ? "#08634e" : "#b13740";
      ctx.beginPath();
      ctx.moveTo(x(index), y(row.high));
      ctx.lineTo(x(index), y(row.low));
      ctx.stroke();
      ctx.fillRect(x(index) - bodyWidth / 2, y(Math.max(row.close, row.open)),
        bodyWidth, Math.max(1, Math.abs(y(row.close) - y(row.open))));
    });
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 18, right - left, bottom - 18);
  ctx.clip();
  ctx.strokeStyle = ctx.fillStyle = "#7952b1";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  for (const line of drawings) {
    ctx.beginPath();
    if (line.kind === "horizontal") {
      if (line.price < min || line.price > max) continue;
      ctx.moveTo(left, y(line.price));
      ctx.lineTo(right, y(line.price));
      ctx.textAlign = "right";
      ctx.fillText(money(Math.round(line.price * 100)), right - 4, Math.max(29, y(line.price) - 4));
    } else {
      const index = candles.findIndex(row => row.date === line.date);
      if (index < 0) continue;
      ctx.moveTo(x(index), 18);
      ctx.lineTo(x(index), bottom);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (const trade of replay.trades.filter(trade => trade.status === "filled")) {
    const index = candles.findIndex(row => row.date === trade.date);
    if (index < 0) continue;
    ctx.fillStyle = trade.side === "buy" ? "#08634e" : "#a03236";
    const anchor = lineMode ? values[index].close : values[index].high;
    ctx.fillText(trade.side === "buy" ? "B" : "S", x(index) - 4, y(anchor) - 8);
  }
}

function updateDates(preferred) {
  const stock = setup.stocks.find(stock => stock.symbol === get("stock").value);
  const input = get("start");
  input.min = stock?.dates[0] ?? "";
  input.max = stock?.dates.at(-1) ?? "";
  input.disabled = !stock;
  show("available-dates", stock ? "Available start dates: " + input.min + " to " + input.max : "No matching stock.");
  input.value = stock?.dates.includes(preferred) ? preferred : stock ? setup.challenge_start : "";
  setControls();
}

function startDate() {
  const date = get("start").value;
  const stock = setup.stocks.find(stock => stock.symbol === get("stock").value);
  const session = stock?.dates.find(day => day >= date);
  if (!date || !session || date < stock.dates[0]) {
    throw new Error("Choose a date inside the available range.");
  }
  get("start").value = session;
  if (session !== date) show("message", date + " was not a trading session. Replay starts on " + session + ".");
  return session;
}

function filterStocks(preferred) {
  const term = get("stock-search").value.trim().toLowerCase();
  const matches = setup.stocks.filter(stock => (stock.symbol + " " + stock.name).toLowerCase().includes(term));
  get("stock").replaceChildren(...matches.map(stock => new Option(stock.symbol + " · " + stock.name, stock.symbol)));
  if (matches.some(stock => stock.symbol === preferred)) get("stock").value = preferred;
  updateDates(get("start").value);
}

const start = challenge => api("replays", {
  start: challenge ? null : startDate(), challenge, symbol: get("stock").value
});
const action = (kind, quantity = 0) => run(() =>
  api("replays/" + replay.id + "/actions", { kind, quantity }));

get("restart").onclick = () => run(() => start(false));
get("challenge").onclick = () => run(() => start(true));
get("next").onclick = () => action("next");
get("cancel").onclick = () => action("cancel");
get("quantity").oninput = estimate;
get("trade").onsubmit = event => {
  event.preventDefault();
  action(event.submitter.name, get("quantity").valueAsNumber);
};
window.addEventListener("resize", drawChart);

get("stock-search").oninput = () => { if (setup) filterStocks(get("stock").value); };
get("start").oninput = setControls;
get("stock").onchange = () => updateDates(get("start").value);
get("chart-mode").onchange = drawChart;
get("window").onchange = drawChart;
get("inspect-date").onchange = () => {
  inspectedDate = get("inspect-date").value;
  showCandle();
};

function scrollChart(value) {
  const slider = get("history-window");
  const end = Math.max(Number(slider.min), Math.min(Number(slider.max), value));
  chartEnd = end === Number(slider.max) ? null : end;
  inspectedDate = null;
  drawChart();
}

const slider = get("history-window");
slider.oninput = () => scrollChart(Number(slider.value));
const canvas = get("chart");

function chooseTool(tool) {
  chartTool = tool;
  canvas.dataset.tool = tool;
  for (const button of drawingTools) {
    button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
  }
  const help = {
    pan: "Drag to pan. Scroll on the chart or use the zoom buttons.",
    horizontal: "Click a price level to mark support, resistance, supply, or demand.",
    vertical: "Click a session to mark its date."
  };
  show("chart-help", help[tool]);
}

function drawingKey() {
  return "papertrade-lines-" + replay.id;
}

function readDrawings() {
  return JSON.parse(localStorage.getItem(drawingKey()) || "[]");
}

function writeDrawings(drawings) {
  localStorage.setItem(drawingKey(), JSON.stringify(drawings));
  drawChart();
}

for (const button of drawingTools) button.onclick = () => chooseTool(button.dataset.tool);
get("undo-line").onclick = () => writeDrawings(readDrawings().slice(0, -1));

function zoom(direction, anchor = 1) {
  if (!replay) return;
  const select = get("window");
  const before = Number(select.value);
  const next = select.selectedIndex + direction;
  if (next < 0 || next >= select.options.length) return;
  if (direction > 0 && before >= replay.candles.length) return;
  const latest = replay.candles.length;
  const previousEnd = Number(slider.value);
  select.selectedIndex = next;
  const after = Number(select.value);
  const shift = Math.round((Math.min(after, latest) - Math.min(before, latest)) * (1 - anchor));
  chartEnd = Math.min(latest, previousEnd + shift);
  if (chartEnd === latest) chartEnd = null;
  drawChart();
}

get("zoom-in").onclick = () => zoom(-1);
get("zoom-out").onclick = () => zoom(1);
let lastWheel = 0;
canvas.addEventListener("wheel", event => {
  if (!replay || !event.deltaY) return;
  event.preventDefault();
  if (performance.now() - lastWheel < 100) return;
  lastWheel = performance.now();
  const { left, right } = drawingGeometry;
  const anchor = Math.max(0, Math.min(1, (event.offsetX - left) / (right - left)));
  zoom(event.deltaY > 0 ? 1 : -1, anchor);
}, { passive: false });

canvas.onpointerdown = event => {
  if (!replay || event.button !== 0) return;
  if (chartTool !== "pan") {
    const { candles, left, right, bottom, slot, min, max } = drawingGeometry;
    const { offsetX: x, offsetY: y } = event;
    if (x < left || x >= right || y < 18 || y > bottom) return;
    const line = chartTool === "horizontal"
      ? { kind: chartTool, price: Math.round((min + (max - min) * (bottom - y) / (bottom - 18)) * 100) / 100 }
      : { kind: chartTool, date: candles[Math.floor((x - left) / slot)].date };
    writeDrawings([...readDrawings(), line]);
    chooseTool("pan");
    return;
  }
  if (slider.disabled) return;
  drag = { x: event.clientX, end: Number(slider.value) };
  canvas.setPointerCapture(event.pointerId);
};
canvas.onpointermove = event => {
  if (!drag) return;
  scrollChart(drag.end - Math.round((event.clientX - drag.x) / drawingGeometry.slot));
};
canvas.onlostpointercapture = () => { drag = null; };

run(async () => {
  setup = await api("setup");
  filterStocks("RELIANCE");
  const saved = localStorage.getItem("papertrade-session");
  if (saved) {
    try {
      const restored = await api("replays/" + saved);
      get("stock").value = restored.symbol;
      updateDates(restored.candles[restored.start].date);
      return restored;
    } catch (error) {
      if (![404, 410, 422].includes(error.status)) throw error;
    }
  }
  return start(false);
});

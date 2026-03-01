const DB_FILE = "./madrasa.db";

const state = {
  db: null,
  tables: [],
  activeTable: "",
  allRows: [],
  filteredRows: [],
};

const themeMeta = document.getElementById("theme-color-meta");
const header = document.getElementById("app-header");
const navItems = document.querySelectorAll(".nav-item");
const tabPanels = document.querySelectorAll(".tab-panel");

const dbStatus = document.getElementById("dbStatus");
const reloadBtn = document.getElementById("reloadBtn");
const tableSelect = document.getElementById("tableSelect");
const searchInput = document.getElementById("searchInput");
const tableWrap = document.getElementById("tableWrap");
const tableMeta = document.getElementById("tableMeta");
const schemaView = document.getElementById("schemaView");
const summaryList = document.getElementById("summaryList");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");

function updateStatus(message, type = "loading") {
  dbStatus.textContent = message;
  dbStatus.className = `status-pill ${type}`;
}

function switchTab(tabId, color) {
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.tab === tabId));
  header.style.backgroundColor = color;
  themeMeta.setAttribute("content", color);
}

function getSingleValue(query) {
  const result = state.db.exec(query);
  if (!result.length || !result[0].values.length) return 0;
  return result[0].values[0][0];
}

function escapeLike(value) {
  return String(value).replace(/'/g, "''");
}

function renderTable(rows, columns) {
  if (!rows.length) {
    tableWrap.innerHTML = "<p style='padding:12px;'>কোনো ডেটা পাওয়া যায়নি।</p>";
    return;
  }

  const head = columns.map((col) => `<th>${col}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`)
    .join("");

  tableWrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function populateSummary() {
  summaryList.innerHTML = "";
  state.tables.forEach((table) => {
    const count = getSingleValue(`SELECT COUNT(*) FROM \"${table.name}\";`);
    const div = document.createElement("div");
    div.className = "summary-item";
    div.innerHTML = `<strong>${table.name}</strong><br>মোট রেকর্ড: ${count}`;
    summaryList.appendChild(div);
  });
}

function updateSchemaView() {
  const current = state.tables.find((t) => t.name === state.activeTable);
  schemaView.textContent = current?.sql || "স্কিমা পাওয়া যায়নি";
}

function loadSelectedTable() {
  const table = tableSelect.value;
  state.activeTable = table;
  const result = state.db.exec(`SELECT * FROM \"${table}\";`);

  if (!result.length) {
    state.allRows = [];
    state.filteredRows = [];
    tableMeta.textContent = "খালি টেবিল";
    renderTable([], []);
    updateSchemaView();
    return;
  }

  const { columns, values } = result[0];
  state.allRows = values;
  state.filteredRows = values;
  tableMeta.textContent = `কলাম: ${columns.length} | রেকর্ড: ${values.length}`;
  renderTable(values, columns);
  updateSchemaView();
}

function filterTable() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    state.filteredRows = state.allRows;
  } else {
    state.filteredRows = state.allRows.filter((row) => row.some((cell) => String(cell ?? "").toLowerCase().includes(q)));
  }

  const result = state.db.exec(`SELECT * FROM \"${state.activeTable}\" LIMIT 1;`);
  const columns = result.length ? result[0].columns : [];
  tableMeta.textContent = `ফিল্টার ফলাফল: ${state.filteredRows.length}/${state.allRows.length}`;
  renderTable(state.filteredRows, columns);
}

function downloadCurrentCsv() {
  if (!state.activeTable) return;
  const result = state.db.exec(`SELECT * FROM \"${state.activeTable}\";`);
  if (!result.length) return;

  const { columns, values } = result[0];
  const lines = [columns.join(",")];
  values.forEach((row) => {
    lines.push(row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.activeTable}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadDatabase() {
  updateStatus("লোড হচ্ছে...", "loading");
  tableWrap.innerHTML = "<p style='padding:12px;'>ডাটাবেজ লোড হচ্ছে...</p>";

  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });

    const response = await fetch(DB_FILE);
    if (!response.ok) {
      throw new Error("madrasa.db পাওয়া যায়নি। ফাইলটি একই ফোল্ডারে রাখুন।");
    }

    const buffer = await response.arrayBuffer();
    state.db = new SQL.Database(new Uint8Array(buffer));

    const tableResult = state.db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    state.tables = (tableResult[0]?.values || []).map(([name, sql]) => ({ name, sql }));

    if (!state.tables.length) {
      throw new Error("কোনো টেবিল পাওয়া যায়নি।");
    }

    tableSelect.innerHTML = state.tables.map((table) => `<option value="${table.name}">${table.name}</option>`).join("");

    state.activeTable = state.tables[0].name;
    tableSelect.value = state.activeTable;
    loadSelectedTable();
    populateSummary();
    updateStatus(`সফল: ${state.tables.length} টি টেবিল`, "ok");
  } catch (error) {
    updateStatus("লোড ব্যর্থ", "error");
    tableWrap.innerHTML = `<p style='padding:12px;color:#c62828;'>${error.message}</p>`;
    schemaView.textContent = "";
    summaryList.innerHTML = "";
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(item.dataset.tab, item.dataset.header || "#003d3d");
  });
});

reloadBtn.addEventListener("click", loadDatabase);
tableSelect.addEventListener("change", loadSelectedTable);
searchInput.addEventListener("input", filterTable);
downloadCsvBtn.addEventListener("click", downloadCurrentCsv);

switchTab("home", "#003d3d");
loadDatabase();

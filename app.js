const DB_FILE = "./madrasa.db";
const DB_SNAPSHOT_KEY = "madrasa_db_snapshot_v1";
const ALLOWED_TYPES = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB"];

const state = {
  db: null,
  tables: [],
  activeTable: "",
  allRows: [],
  filteredRows: [],
  columns: [
    { name: "name", type: "TEXT" },
    { name: "class", type: "TEXT" },
  ],
  gridRows: ["", "", ""].map(() => ["", ""]),
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

const newTableName = document.getElementById("newTableName");
const addColumnBtn = document.getElementById("addColumnBtn");
const addRowBtn = document.getElementById("addRowBtn");
const createTableBtn = document.getElementById("createTableBtn");
const columnEditor = document.getElementById("columnEditor");
const excelTable = document.getElementById("excelTable");

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

function sanitizeIdentifier(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_+/g, "_");
}

function toSafeIdentifier(rawName, fallback) {
  let cleaned = sanitizeIdentifier(rawName);
  if (!cleaned) cleaned = fallback;
  if (!/^[a-zA-Z_]/.test(cleaned)) cleaned = `_${cleaned}`;
  if (cleaned.length > 63) cleaned = cleaned.slice(0, 63);
  return cleaned;
}

function getSingleValue(query) {
  const result = state.db.exec(query);
  if (!result.length || !result[0].values.length) return 0;
  return result[0].values[0][0];
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
    const count = getSingleValue(`SELECT COUNT(*) FROM "${table.name}";`);
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

function refreshTableList(preferredTable = "") {
  const tableResult = state.db.exec(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  state.tables = (tableResult[0]?.values || []).map(([name, sql]) => ({ name, sql }));

  tableSelect.innerHTML = state.tables.map((table) => `<option value="${table.name}">${table.name}</option>`).join("");

  const fallback = state.tables[0]?.name || "";
  state.activeTable =
    preferredTable && state.tables.some((t) => t.name === preferredTable) ? preferredTable : fallback;
  tableSelect.value = state.activeTable;

  searchInput.value = "";

  if (state.activeTable) {
    loadSelectedTable();
    updateSchemaView();
  } else {
    tableWrap.innerHTML = "<p style='padding:12px;'>কোনো টেবিল নেই।</p>";
    tableMeta.textContent = "টেবিল নেই";
    schemaView.textContent = "স্কিমা পাওয়া যায়নি";
  }

  populateSummary();
}

function loadSelectedTable() {
  const table = tableSelect.value;
  if (!table) {
    tableWrap.innerHTML = "<p style='padding:12px;'>কোনো টেবিল নেই।</p>";
    tableMeta.textContent = "টেবিল নেই";
    return;
  }

  state.activeTable = table;
  const result = state.db.exec(`SELECT * FROM "${table}";`);

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
  if (!state.activeTable) return;

  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    state.filteredRows = state.allRows;
  } else {
    state.filteredRows = state.allRows.filter((row) =>
      row.some((cell) => String(cell ?? "").toLowerCase().includes(q))
    );
  }

  const result = state.db.exec(`SELECT * FROM "${state.activeTable}" LIMIT 1;`);
  const columns = result.length ? result[0].columns : [];
  tableMeta.textContent = `ফিল্টার ফলাফল: ${state.filteredRows.length}/${state.allRows.length}`;
  renderTable(state.filteredRows, columns);
}

function downloadCurrentCsv() {
  if (!state.activeTable) return;
  const result = state.db.exec(`SELECT * FROM "${state.activeTable}";`);
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

function ensureGridShape() {
  if (!state.columns.length) {
    state.columns.push({ name: "column_1", type: "TEXT" });
  }

  if (!state.gridRows.length) {
    state.gridRows.push(Array.from({ length: state.columns.length }, () => ""));
  }

  state.gridRows = state.gridRows.map((row) => {
    const adjusted = row.slice(0, state.columns.length);
    while (adjusted.length < state.columns.length) adjusted.push("");
    return adjusted;
  });
}

function renderColumnEditor() {
  columnEditor.innerHTML = "";

  state.columns.forEach((col, index) => {
    const row = document.createElement("div");
    row.className = "column-row";

    const colInput = document.createElement("input");
    colInput.value = col.name;
    colInput.placeholder = `কলাম ${index + 1}`;
    colInput.addEventListener("input", (e) => {
      state.columns[index].name = e.target.value;
      renderExcelGrid();
    });

    const typeSelect = document.createElement("select");
    typeSelect.className = "col-type";
    ALLOWED_TYPES.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      option.selected = col.type === type;
      typeSelect.appendChild(option);
    });

    typeSelect.addEventListener("change", (e) => {
      const selected = String(e.target.value || "").toUpperCase();
      state.columns[index].type = ALLOWED_TYPES.includes(selected) ? selected : "TEXT";
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-column-btn";
    removeBtn.title = "কলাম মুছুন";
    removeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
    removeBtn.disabled = state.columns.length <= 1;
    removeBtn.addEventListener("click", () => {
      if (state.columns.length <= 1) return;
      state.columns.splice(index, 1);
      ensureGridShape();
      renderColumnEditor();
      renderExcelGrid();
    });

    row.append(colInput, typeSelect, removeBtn);
    columnEditor.appendChild(row);
  });
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderExcelGrid() {
  ensureGridShape();

  const headCells = state.columns
    .map((col, index) => `<th>${toSafeIdentifier(col.name, `column_${index + 1}`)}</th>`)
    .join("");

  const bodyRows = state.gridRows
    .map((row, rowIndex) => {
      const cells = row
        .map(
          (cellValue, colIndex) =>
            `<td><input class="excel-input" data-row="${rowIndex}" data-col="${colIndex}" value="${escapeHtmlAttr(
              cellValue
            )}" /></td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  excelTable.innerHTML = `<thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody>`;

  excelTable.querySelectorAll(".excel-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const row = Number(e.target.dataset.row);
      const col = Number(e.target.dataset.col);
      state.gridRows[row][col] = e.target.value;
    });
  });
}

function collectSanitizedColumns() {
  const used = new Set();
  return state.columns.map((col, index) => {
    const baseName = toSafeIdentifier(col.name, `column_${index + 1}`);
    let finalName = baseName;
    let n = 2;

    while (used.has(finalName.toLowerCase())) {
      finalName = `${baseName}_${n}`;
      n += 1;
    }

    used.add(finalName.toLowerCase());

    const safeType = ALLOWED_TYPES.includes(String(col.type || "").toUpperCase())
      ? String(col.type).toUpperCase()
      : "TEXT";

    return { name: finalName, type: safeType };
  });
}

function persistDatabaseSnapshot() {
  try {
    const bytes = state.db.export();
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    localStorage.setItem(DB_SNAPSHOT_KEY, btoa(binary));
  } catch (error) {
    console.error("Database snapshot save failed:", error);
  }
}

function loadPersistedSnapshot() {
  try {
    const encoded = localStorage.getItem(DB_SNAPSHOT_KEY);
    if (!encoded) return null;

    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Database snapshot load failed:", error);
    return null;
  }
}

function createTableWithGrid() {
  if (!state.db) {
    alert("ডাটাবেজ এখনো লোড হয়নি।");
    return;
  }

  const tableName = toSafeIdentifier(newTableName.value, "");
  if (!tableName) {
    alert("টেবিল নাম দিন।");
    return;
  }

  const exists = state.tables.some((table) => table.name.toLowerCase() === tableName.toLowerCase());
  if (exists) {
    alert("এই টেবিল নাম আগে থেকেই আছে।");
    return;
  }

  const columns = collectSanitizedColumns();
  const columnSql = columns.map((col) => `"${col.name}" ${col.type}`).join(", ");

  try {
    state.db.exec("BEGIN TRANSACTION;");
    state.db.exec(`CREATE TABLE "${tableName}" (${columnSql});`);

    const filledRows = state.gridRows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));

    if (filledRows.length) {
      const insertSql = `INSERT INTO "${tableName}" (${columns
        .map((c) => `"${c.name}"`)
        .join(",")}) VALUES (${columns.map(() => "?").join(",")});`;
      const stmt = state.db.prepare(insertSql);

      filledRows.forEach((row) => {
        const normalized = row.slice(0, columns.length).map((value) => {
          const str = String(value ?? "");
          return str.trim() === "" ? null : str;
        });
        while (normalized.length < columns.length) normalized.push(null);
        stmt.run(normalized);
      });

      stmt.free();
    }

    state.db.exec("COMMIT;");

    persistDatabaseSnapshot();
    refreshTableList(tableName);
    updateStatus(`নতুন টেবিল তৈরি: ${tableName}`, "ok");
    alert(`টেবিল তৈরি সম্পন্ন: ${tableName}`);
  } catch (error) {
    try {
      state.db.exec("ROLLBACK;");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    updateStatus("টেবিল তৈরি ব্যর্থ", "error");
    alert(error.message);
  }
}

function addColumn() {
  state.columns.push({ name: `column_${state.columns.length + 1}`, type: "TEXT" });
  ensureGridShape();
  renderColumnEditor();
  renderExcelGrid();
}

function addRow() {
  state.gridRows.push(Array.from({ length: state.columns.length }, () => ""));
  renderExcelGrid();
}

async function loadDatabase() {
  updateStatus("লোড হচ্ছে...", "loading");
  tableWrap.innerHTML = "<p style='padding:12px;'>ডাটাবেজ লোড হচ্ছে...</p>";

  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });

    const persistedBytes = loadPersistedSnapshot();

    if (persistedBytes) {
      state.db = new SQL.Database(persistedBytes);
    } else {
      const response = await fetch(DB_FILE);
      if (!response.ok) {
        throw new Error("madrasa.db পাওয়া যায়নি। ফাইলটি একই ফোল্ডারে রাখুন।");
      }

      const buffer = await response.arrayBuffer();
      state.db = new SQL.Database(new Uint8Array(buffer));
    }

    refreshTableList();
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

reloadBtn.addEventListener("click", async () => {
  localStorage.removeItem(DB_SNAPSHOT_KEY);
  await loadDatabase();
});
tableSelect.addEventListener("change", loadSelectedTable);
searchInput.addEventListener("input", filterTable);
downloadCsvBtn.addEventListener("click", downloadCurrentCsv);
addColumnBtn.addEventListener("click", addColumn);
addRowBtn.addEventListener("click", addRow);
createTableBtn.addEventListener("click", createTableWithGrid);

renderColumnEditor();
renderExcelGrid();
switchTab("home", "#003d3d");
loadDatabase();

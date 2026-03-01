const state = {
  classes: [],
  months: [],
  feeSettings: null,
  currentStudent: null,
  activePage: "Dashboard",
  sidebarExpanded: true,
};

const classPalette = {
  play: { bg: "#fff7ed", fg: "#9a3412" },
  nursery: { bg: "#eff6ff", fg: "#1e40af" },
  "1st": { bg: "#fef2f2", fg: "#991b1b" },
  "2nd": { bg: "#fff7ed", fg: "#9a3412" },
  "3rd": { bg: "#fefce8", fg: "#854d0e" },
  "4th": { bg: "#ecfccb", fg: "#3f6212" },
  "5th": { bg: "#ecfeff", fg: "#155e75" },
  "6th": { bg: "#eff6ff", fg: "#1e40af" },
  hifz: { bg: "#fdf2f8", fg: "#9d174d" },
};

const pageEl = document.getElementById("page");
const sidebarEl = document.getElementById("sidebar");
const toastEl = document.getElementById("toast");

function apiGet(path) {
  return fetch(path, { headers: { Accept: "application/json" } }).then(handleJson);
}

function apiSend(path, method, payload, headers = {}) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: payload ? JSON.stringify(payload) : null,
  }).then(handleJson);
}

function handleJson(res) {
  if (!res.ok) {
    return res
      .json()
      .catch(() => ({ error: "Request failed" }))
      .then((data) => {
        throw new Error(data.error || "Request failed");
      });
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

function showToast(message, type = "info") {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  toastEl.style.background =
    type === "error" ? "#ef4444" : type === "success" ? "#16a34a" : "#0f172a";
  setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonthFees(items) {
  return (items || [])
    .map(
      (item) =>
        `${item.month_label || item.month}:${formatMoney(
          item.monthly_fee
        )}/${formatMoney(item.food_fee)}/${formatMoney(item.other_fee)}`
    )
    .join(", ");
}

function parseAmount(value) {
  const cleaned = String(value || "").replace(/,/g, "").trim();
  if (!cleaned) {
    throw new Error("Amount is required.");
  }
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) {
    throw new Error("Please enter a valid number.");
  }
  return parsed;
}

function formatPrintMeta() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Date: ${date}  Time: ${time}`;
}

function sanitizeMobile(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeClass(value) {
  return String(value || "").trim().toLowerCase();
}

function hexToRgb(value) {
  const clean = value.replace("#", "");
  return [0, 2, 4].map((start) => parseInt(clean.slice(start, start + 2), 16));
}

function rgbToHex(rgb) {
  return (
    "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")
  );
}

function mixColors(colorA, colorB, amount) {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const mixed = rgbA.map((channel, idx) =>
    Math.round(channel + (rgbB[idx] - channel) * amount)
  );
  return rgbToHex(mixed);
}

function applyClassRowStyle(row, className, isEven) {
  const normalized = normalizeClass(className);
  const palette = classPalette[normalized] || { bg: "#f8fafc", fg: "#0f172a" };
  const shade = isEven ? 0.22 : 0.06;
  const background = mixColors(palette.bg, "#eef2f7", shade);
  row.style.background = background;
  row.style.color = palette.fg;
}

function openModal(title, bodyHtml, actions) {
  const modal = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  const body = document.getElementById("modalBody");
  const actionsEl = document.getElementById("modalActions");
  body.innerHTML = bodyHtml;
  actionsEl.innerHTML = "";
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.className = action.className || "secondary";
    btn.addEventListener("click", action.onClick);
    actionsEl.appendChild(btn);
  });
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function buildCard(innerHtml, extraClass = "") {
  return `
    <div class="card ${extraClass}">
      <div class="card-inner">
        ${innerHtml}
      </div>
    </div>
  `;
}

function buildTable(headers, rows) {
  const headHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
    )
    .join("");
  return `
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

function buildClassTables(groups, headers, rowBuilder) {
  return (groups || [])
    .map((group) => {
      const rows = (group.rows || []).map(rowBuilder);
      const table = buildTable(headers, rows);
      const classLabel = group.class || "N/A";
      return `
        <div class="class-section">
          <h3>Class: ${classLabel}</h3>
          ${table}
        </div>
      `;
    })
    .join("");
}

function downloadCsv(filename, headers, rows) {
  const lines = [];
  lines.push(headers.join(","));
  rows.forEach((row) => {
    const line = row
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",");
    lines.push(line);
  });
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadFile(url, filename) {
  fetch(url)
    .then((res) => {
      if (!res.ok) {
        return res
          .json()
          .catch(() => ({ error: "Download failed" }))
          .then((data) => {
            throw new Error(data.error || "Download failed");
          });
      }
      return res.blob();
    })
    .then((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    })
    .catch((err) => showToast(err.message, "error"));
}

function setActivePage(page) {
  state.activePage = page;
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  renderPage(page);
}

function buildSelectOptions(options, selected) {
  return options
    .map(
      (opt) =>
        `<option value="${opt}" ${opt === selected ? "selected" : ""}>${opt}</option>`
    )
    .join("");
}

async function renderDashboard() {
  pageEl.innerHTML = `
    <h1 class="title">Dashboard</h1>
    ${buildCard(`
      <label>Total Fees Collected</label>
      <div class="summary-value" id="totalFeesValue">0.00</div>
    `)}
    ${buildCard(`
      <label>Search Student (Name, ID, Class, or Phone)</label>
      <input type="text" id="studentSearch" placeholder="Search by Name, ID, Class, or Phone" />
    `)}
    ${buildCard(`
      <div class="row space-between">
        <label>Matching Records</label>
        <div class="helper-text" id="dashboardSearchCount">0 records</div>
      </div>
      <div id="dashboardSearchResults" class="table-wrap" style="margin-top: 8px;"></div>
    `)}
    ${buildCard(`
      <div class="grid two">
        <div class="inline-label"><strong>ID:</strong> <span id="infoId"></span></div>
        <div class="inline-label"><strong>Name:</strong> <span id="infoName"></span></div>
        <div class="inline-label"><strong>Father:</strong> <span id="infoFather"></span></div>
        <div class="inline-label"><strong>Address:</strong> <span id="infoAddress"></span></div>
        <div class="inline-label"><strong>Class:</strong> <span id="infoClass"></span></div>
        <div class="inline-label"><strong>Mobile:</strong> <span id="infoMobile"></span></div>
      </div>
    `)}
    <div class="button-row" style="margin: 8px 20px;">
      <button class="primary" id="addPaymentBtn">Add Payment</button>
      <button class="secondary" id="uploadImageBtn">Upload Image</button>
      <button class="secondary" id="exportImagesBtn">Export Class Images</button>
      <button class="danger" id="deleteStudentBtn">Delete</button>
      <button class="secondary" id="printProfileBtn">Export Profile TXT</button>
    </div>
  `;

  const searchInput = document.getElementById("studentSearch");
  const searchResultsEl = document.getElementById("dashboardSearchResults");
  const searchCountEl = document.getElementById("dashboardSearchCount");
  const infoFields = {
    id: document.getElementById("infoId"),
    name: document.getElementById("infoName"),
    father: document.getElementById("infoFather"),
    address: document.getElementById("infoAddress"),
    class: document.getElementById("infoClass"),
    mobile: document.getElementById("infoMobile"),
  };
  const totalFeesEl = document.getElementById("totalFeesValue");
  let searchMatches = [];

  async function loadTotalFees() {
    try {
      const data = await apiGet("/api/payments/total");
      totalFeesEl.textContent = formatMoney(data.total || 0);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function setCurrentStudent(student) {
    if (!student) {
      Object.values(infoFields).forEach((el) => (el.textContent = ""));
      state.currentStudent = null;
      return;
    }
    infoFields.id.textContent = student.student_id || "";
    infoFields.name.textContent = student.name || "";
    infoFields.father.textContent = student.father_name || "";
    infoFields.address.textContent = student.address || "";
    infoFields.class.textContent = student.class || "";
    infoFields.mobile.textContent = student.mobile || "";
    state.currentStudent = student;
  }

  function renderSearchResults() {
    if (!searchInput.value.trim()) {
      searchCountEl.textContent = "0 records";
      searchResultsEl.innerHTML =
        '<div class="helper-text">Type to search records.</div>';
      return;
    }

    searchCountEl.textContent = `${searchMatches.length} record${
      searchMatches.length === 1 ? "" : "s"
    }`;

    if (!searchMatches.length) {
      searchResultsEl.innerHTML =
        '<div class="helper-text">No matching records found.</div>';
      return;
    }

    const rows = searchMatches
      .map(
        (student) => `
          <tr>
            <td>${student.student_id || ""}</td>
            <td>${student.name || ""}</td>
            <td>${student.class || ""}</td>
            <td>${student.mobile || ""}</td>
            <td>
              <button class="secondary dashboard-edit-btn" data-student-id="${
                student.student_id
              }">EDIT</button>
            </td>
          </tr>
        `
      )
      .join("");

    searchResultsEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Class</th>
            <th>Phone</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    searchResultsEl.querySelectorAll(".dashboard-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const studentId = btn.dataset.studentId;
        const student = searchMatches.find((item) => item.student_id === studentId);
        if (!student) {
          return;
        }
        setCurrentStudent(student);
        openEditStudent(student);
      });
    });
  }

  function openEditStudent(student) {
    openModal(
      `Edit Student ${student.student_id}`,
      `
        <div class="grid">
          <label>Student ID</label>
          <input type="text" id="editStudentId" readonly value="${student.student_id}" />
          <label>Name</label>
          <input type="text" id="editStudentName" value="${student.name || ""}" />
          <label>Father's Name</label>
          <input type="text" id="editStudentFather" value="${student.father_name || ""}" />
          <label>Address</label>
          <input type="text" id="editStudentAddress" value="${student.address || ""}" />
          <label>Class</label>
          <select id="editStudentClass">${buildSelectOptions(
            state.classes,
            student.class || state.classes[0]
          )}</select>
          <label>Phone</label>
          <input type="text" id="editStudentMobile" inputmode="numeric" value="${student.mobile || ""}" />
        </div>
      `,
      [
        {
          label: "Save Changes",
          className: "primary",
          onClick: async () => {
            try {
              const mobileRaw = document.getElementById("editStudentMobile").value;
              const mobile = sanitizeMobile(mobileRaw);
              if (mobile && (mobile.length < 10 || mobile.length > 15)) {
                throw new Error("Mobile number must be 10-15 digits.");
              }
              const payload = {
                name: document.getElementById("editStudentName").value.trim(),
                father_name: document
                  .getElementById("editStudentFather")
                  .value.trim(),
                address: document
                  .getElementById("editStudentAddress")
                  .value.trim(),
                class: document.getElementById("editStudentClass").value,
                mobile,
              };
              const updated = await apiSend(
                `/api/students/${encodeURIComponent(student.student_id)}`,
                "PUT",
                payload
              );
              closeModal();
              showToast("Student updated.", "success");
              setCurrentStudent(updated);
              await loadDashboardMatches(searchInput.value.trim());
            } catch (err) {
              showToast(err.message, "error");
            }
          },
        },
        { label: "Cancel", className: "secondary", onClick: closeModal },
      ]
    );
  }

  async function loadDashboardMatches(query) {
    if (!query) {
      searchMatches = [];
      renderSearchResults();
      setCurrentStudent(null);
      return;
    }
    try {
      const result = await apiGet(`/api/students?search=${encodeURIComponent(query)}`);
      searchMatches = result || [];
      renderSearchResults();
      if (searchMatches.length > 0) {
        setCurrentStudent(searchMatches[0]);
      } else {
        setCurrentStudent(null);
      }
    } catch (err) {
      showToast(err.message, "error");
      searchMatches = [];
      renderSearchResults();
      setCurrentStudent(null);
    }
  }

  let searchTimer;
  searchInput.addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    const value = event.target.value.trim();
    searchTimer = setTimeout(() => loadDashboardMatches(value), 200);
  });

  document.getElementById("deleteStudentBtn").addEventListener("click", async () => {
    if (!state.currentStudent) {
      showToast("No student selected.", "error");
      return;
    }
    if (!confirm(`Delete student ${state.currentStudent.student_id}?`)) {
      return;
    }
    try {
      await apiSend(
        `/api/students/${encodeURIComponent(state.currentStudent.student_id)}`,
        "DELETE"
      );
      showToast("Student deleted.", "success");
      await loadTotalFees();
      await loadDashboardMatches(searchInput.value.trim());
      searchInput.value = "";
      searchMatches = [];
      renderSearchResults();
      setCurrentStudent(null);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("addPaymentBtn").addEventListener("click", async () => {
    if (!state.currentStudent) {
      showToast("No student selected.", "error");
      return;
    }
    const fee = state.feeSettings || {
      monthly_fee: 0,
      food_fee: 0,
      other_fee: 0,
    };
    const isHifz = normalizeClass(state.currentStudent.class) === "hifz";
    const months = state.months;
    const currentMonth = months[new Date().getMonth()];

    async function submitPayment(exportReceiptTxt) {
      const payload = {
        student_id: state.currentStudent.student_id,
        student_name: state.currentStudent.name,
        received_by: document.getElementById("payReceivedBy").value.trim(),
        month: document.getElementById("payMonth").value,
        year: new Date().getFullYear(),
        notes: document.getElementById("payNotes").value.trim(),
        monthly_fee: parseAmount(document.getElementById("payMonthly").value),
        food_fee: isHifz ? parseAmount(document.getElementById("payFood").value) : null,
        other_fee: parseAmount(document.getElementById("payOther").value),
      };
      if (!payload.received_by) {
        throw new Error("Please enter staff/cashier name.");
      }
      await apiSend("/api/payments", "POST", payload);
      await loadTotalFees();
      if (exportReceiptTxt) {
        const receiptPayload = {
          student_id: payload.student_id,
          name: payload.student_name,
          month: payload.month,
          year: payload.year,
          received_by: payload.received_by,
          monthly_fee: payload.monthly_fee,
          food_fee: payload.food_fee,
          other_fee: payload.other_fee,
        };
        const res = await fetch("/api/reports/payment-receipt/txt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(receiptPayload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Receipt failed" }));
          throw new Error(data.error || "Receipt failed");
        }
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "payment_receipt.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    }

    openModal(
      `Payment for ${state.currentStudent.name}`,
      `
        <div class="grid">
          <label>Student ID</label>
          <input type="text" id="payStudentId" readonly value="${state.currentStudent.student_id}" />
          <label>Student Name</label>
          <input type="text" id="payStudentName" readonly value="${state.currentStudent.name}" />
          <label>Received By (Staff/Cashier)</label>
          <input type="text" id="payReceivedBy" />
          <label>Month</label>
          <select id="payMonth">${buildSelectOptions(months, currentMonth)}</select>
          <label>Payment Type / Notes (Optional)</label>
          <input type="text" id="payNotes" />
          <label>Monthly Fee</label>
          <input type="number" id="payMonthly" value="${fee.monthly_fee}" />
          ${
            isHifz
              ? `<label>Food Fee</label><input type="number" id="payFood" value="${fee.food_fee}" />`
              : ""
          }
          <label>Other Fees</label>
          <input type="number" id="payOther" value="${fee.other_fee}" />
        </div>
      `,
      [
        {
          label: "Save Payment",
          className: "primary",
          onClick: async () => {
            try {
              await submitPayment(false);
              showToast("Payment saved.", "success");
              closeModal();
            } catch (err) {
              showToast(err.message, "error");
            }
          },
        },
        {
          label: "Save & Export TXT",
          className: "secondary",
          onClick: async () => {
            try {
              await submitPayment(true);
              showToast("Payment saved.", "success");
              closeModal();
            } catch (err) {
              showToast(err.message, "error");
            }
          },
        },
        { label: "Cancel", className: "secondary", onClick: closeModal },
      ]
    );
  });

  document.getElementById("uploadImageBtn").addEventListener("click", () => {
    if (!state.currentStudent) {
      showToast("No student selected.", "error");
      return;
    }
    openModal(
      "Upload Student Image",
      `
        <div class="grid">
          <label>Select Image</label>
          <input type="file" id="studentImageFile" accept="image/*" />
        </div>
      `,
      [
        {
          label: "Upload",
          className: "primary",
          onClick: async () => {
            const file = document.getElementById("studentImageFile").files[0];
            if (!file) {
              showToast("Please choose an image.", "error");
              return;
            }
            const form = new FormData();
            form.append("image", file);
            try {
              const res = await fetch(
                `/api/students/${encodeURIComponent(
                  state.currentStudent.student_id
                )}/image`,
                {
                  method: "POST",
                  body: form,
                }
              );
              if (!res.ok) {
                const data = await res
                  .json()
                  .catch(() => ({ error: "Upload failed" }));
                throw new Error(data.error || "Upload failed");
              }
              showToast("Image saved.", "success");
              closeModal();
            } catch (err) {
              showToast(err.message, "error");
            }
          },
        },
        { label: "Cancel", className: "secondary", onClick: closeModal },
      ]
    );
  });

  document.getElementById("exportImagesBtn").addEventListener("click", () => {
    openModal(
      "Export Class Images",
      `
        <div class="grid">
          <label>Select Class</label>
          <select id="classExportSelect">${buildSelectOptions(
            state.classes,
            state.classes[0]
          )}</select>
          <div class="helper-text">Downloads a zip file with available student images.</div>
        </div>
      `,
      [
        {
          label: "Download",
          className: "primary",
          onClick: () => {
            const selected = document.getElementById("classExportSelect").value;
            const filename = `class_${selected}_images.zip`;
            downloadFile(
              `/api/students/class-images?class=${encodeURIComponent(selected)}`,
              filename
            );
            closeModal();
          },
        },
        { label: "Cancel", className: "secondary", onClick: closeModal },
      ]
    );
  });

  document.getElementById("printProfileBtn").addEventListener("click", () => {
    if (!state.currentStudent) {
      showToast("No student selected.", "error");
      return;
    }
    downloadFile(
      `/api/reports/profile/txt?student_id=${encodeURIComponent(
        state.currentStudent.student_id
      )}`,
      "student_profile.txt"
    );
  });

  await loadTotalFees();
  renderSearchResults();
}

async function renderStudents() {
  pageEl.innerHTML = `
    <h1 class="title">Student Management</h1>
    ${buildCard(`
      <div class="row space-between">
        <div class="row">
          <label>Filter by Class:</label>
          <select id="studentClassFilter">${buildSelectOptions(
            ["All Classes", ...state.classes],
            "All Classes"
          )}</select>
        </div>
        <div id="studentStats" class="helper-text">Total Students: 0</div>
      </div>
    `)}
    <div class="row" style="margin: 8px 20px;">
      <label>Search:</label>
      <input type="text" id="studentSearch" placeholder="Search by name, ID, or mobile..." />
      <div class="button-row">
        <button class="secondary" id="studentRefresh">Refresh</button>
        <button class="secondary" id="studentExportCsv">Export CSV</button>
        <button class="secondary" id="studentExportTxt">Export TXT</button>
        <button class="secondary" id="studentPrint">Print</button>
      </div>
    </div>
    <div id="studentsTable"></div>
  `;

  const filterEl = document.getElementById("studentClassFilter");
  const searchEl = document.getElementById("studentSearch");
  const statsEl = document.getElementById("studentStats");
  const tableEl = document.getElementById("studentsTable");
  let currentRows = [];

  async function loadStudents() {
    const classFilter = filterEl.value;
    const query = searchEl.value.trim();
    const params = new URLSearchParams();
    if (classFilter !== "All Classes") {
      params.set("class", classFilter);
    }
    if (query) {
      params.set("search", query);
    }
    try {
      const data = await apiGet(`/api/students?${params.toString()}`);
      currentRows = data || [];
      const rows = currentRows.map((row) => [
        row.student_id,
        row.name,
        row.father_name || "",
        row.address || "",
        row.class || "",
        row.mobile || "",
      ]);
      const headers = [
        "ID No",
        "Name",
        "Father's Name",
        "Address",
        "Class",
        "Mobile",
      ];
      tableEl.innerHTML = buildTable(headers, rows);

      const tbody = tableEl.querySelector("tbody");
      Array.from(tbody.rows).forEach((tr, idx) => {
        applyClassRowStyle(tr, currentRows[idx].class, idx % 2 === 0);
      });

      if (classFilter === "All Classes") {
        statsEl.textContent = `Total Students: ${currentRows.length}`;
      } else {
        statsEl.textContent = `Class ${classFilter}: ${currentRows.length} students`;
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  document.getElementById("studentRefresh").addEventListener("click", loadStudents);
  document
    .getElementById("studentExportCsv")
    .addEventListener("click", () => {
      const headers = [
        "ID No",
        "Name",
        "Father's Name",
        "Address",
        "Class",
        "Mobile",
      ];
      const rows = currentRows.map((row) => [
        row.student_id,
        row.name,
        row.father_name || "",
        row.address || "",
        row.class || "",
        row.mobile || "",
      ]);
      const classFilter = filterEl.value;
      const filename =
        classFilter === "All Classes"
          ? "students.csv"
          : `students_class_${classFilter}.csv`;
      downloadCsv(filename, headers, rows);
    });
  document.getElementById("studentExportTxt").addEventListener("click", () => {
    const params = new URLSearchParams();
    if (filterEl.value !== "All Classes") {
      params.set("class", filterEl.value);
    }
    if (searchEl.value.trim()) {
      params.set("search", searchEl.value.trim());
    }
    downloadFile(`/api/reports/students/txt?${params.toString()}`, "students_report.txt");
  });
  document
    .getElementById("studentPrint")
    .addEventListener("click", () => window.print());

  filterEl.addEventListener("change", loadStudents);
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadStudents, 200);
  });

  await loadStudents();
}

async function renderPaid() {
  pageEl.innerHTML = `
    <h1 class="title">Paid List</h1>
    ${buildCard(`
      <div class="row">
        <label>Class</label>
        <select id="paidClass">${buildSelectOptions(
          ["All", ...state.classes],
          "All"
        )}</select>
        <label>Month</label>
        <select id="paidMonth">${buildSelectOptions(
          ["All", ...state.months],
          "All"
        )}</select>
        <label>Search</label>
        <input type="text" id="paidSearch" placeholder="Search by ID or Name" />
      </div>
    `)}
    <div class="button-row" style="margin: 8px 20px;">
      <button class="secondary" id="paidRefresh">Refresh</button>
      <button class="secondary" id="paidExportCsv">Export CSV</button>
      <button class="secondary" id="paidExportTxt">Export TXT</button>
      <button class="secondary" id="paidPrint">Print</button>
    </div>
    <div class="helper-text" id="paidPrintMeta"></div>
    <div id="paidTable"></div>
  `;

  const classEl = document.getElementById("paidClass");
  const monthEl = document.getElementById("paidMonth");
  const searchEl = document.getElementById("paidSearch");
  const tableEl = document.getElementById("paidTable");
  const printMetaEl = document.getElementById("paidPrintMeta");
  let currentGroups = [];
  let currentSearch = null;

  async function loadPaid() {
    if (printMetaEl) {
      printMetaEl.textContent = formatPrintMeta();
    }
    const params = new URLSearchParams();
    const search = searchEl.value.trim();
    if (search) {
      params.set("search", search);
    } else {
      if (classEl.value !== "All") {
        params.set("class", classEl.value);
      }
      if (monthEl.value !== "All") {
        params.set("month", monthEl.value);
      }
    }
    try {
      const data = await apiGet(`/api/payments/paid?${params.toString()}`);
      currentSearch = data?.search || null;
      if (search) {
        currentGroups = [];
        if (!currentSearch) {
          tableEl.innerHTML = buildCard(
            `<div class="helper-text">No student found.</div>`
          );
          return;
        }

        const totalMonthly = (currentSearch.months || []).reduce(
          (sum, item) => sum + (item.monthly_fee || 0),
          0
        );
        const totalFood = (currentSearch.months || []).reduce(
          (sum, item) => sum + (item.food_fee || 0),
          0
        );
        const totalOther = (currentSearch.months || []).reduce(
          (sum, item) => sum + (item.other_fee || 0),
          0
        );
        const total = totalMonthly + totalFood + totalOther;

        let html = `
          <div class="class-section">
            <div class="card tight" style="margin: 10px 0;">
              <div class="grid two" style="padding: 15px;">
                <div>
                  <p><strong>ID:</strong> ${currentSearch.student_id}</p>
                  <p><strong>Name:</strong> ${currentSearch.name}</p>
                  <p><strong>Class:</strong> ${currentSearch.class || 'N/A'}</p>
                </div>
                <div>
                  <p><strong>Mobile:</strong> ${currentSearch.mobile || 'N/A'}</p>
                </div>
              </div>
            </div>
            <h3>Payment Details - ${currentSearch.name}</h3>
        `;

        const monthHeaders = ["Month", "Monthly Fee", "Food Fee", "Other Fee", "Total"];
        const monthRows = (currentSearch.months || []).map(monthData => {
          const monthly = monthData.monthly_fee || 0;
          const food = monthData.food_fee || 0;
          const other = monthData.other_fee || 0;
          const monthTotal = monthly + food + other;
          return [
            monthData.month,
            formatMoney(monthly),
            formatMoney(food),
            formatMoney(other),
            formatMoney(monthTotal)
          ];
        });

        html += buildTable(monthHeaders, monthRows);

        html += `
            <div class="card tight" style="margin: 10px 0; background: #c8e6c9;">
              <div class="row space-between" style="padding: 10px;">
                <strong>TOTAL:</strong>
                <span>Monthly: ${formatMoney(totalMonthly)}</span>
                <span>Food: ${formatMoney(totalFood)}</span>
                <span>Other: ${formatMoney(totalOther)}</span>
                <span>Grand Total: ${formatMoney(total)}</span>
              </div>
            </div>
          </div>
        `;

        tableEl.innerHTML = html;
        return;
      }

      currentGroups = data?.classes || [];
      const headers = [
        "ID No",
        "Name",
        "Monthly Fee",
        "Food Fee",
        "Other Fee",
        "Months (Monthly/Food/Other)",
        "Total",
      ];
      tableEl.innerHTML = buildClassTables(currentGroups, headers, (row) => {
        const total =
          (row.total_monthly_fee || 0) +
          (row.total_food_fee || 0) +
          (row.total_other_fee || 0);

        return [
          row.student_id,
          row.name,
          formatMoney(row.total_monthly_fee),
          formatMoney(row.total_food_fee),
          formatMoney(row.total_other_fee),
          formatMonthFees(row.month_fees) || "No payments",
          formatMoney(total),
        ];
      });

      const sections = tableEl.querySelectorAll(".class-section");
      sections.forEach((section, sectionIndex) => {
        const group = currentGroups[sectionIndex];
        const tbody = section.querySelector("tbody");
        if (tbody) {
          Array.from(tbody.rows).forEach((tr, idx) => {
            applyClassRowStyle(tr, group.class, idx % 2 === 0);
          });
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  document.getElementById("paidRefresh").addEventListener("click", loadPaid);
  document.getElementById("paidExportCsv").addEventListener("click", () => {
    if (currentSearch) {
      const headers = ["Month", "Monthly Fee", "Food Fee", "Other Fee", "Total"];
      const rows = (currentSearch.months || []).map(monthData => {
        const monthly = monthData.monthly_fee || 0;
        const food = monthData.food_fee || 0;
        const other = monthData.other_fee || 0;
        return [
          monthData.month,
          formatMoney(monthly),
          formatMoney(food),
          formatMoney(other),
          formatMoney(monthly + food + other)
        ];
      });

      const totalMonthly = rows.reduce((sum, r) => sum + parseFloat(r[1].replace(/,/g, '')), 0);
      const totalFood = rows.reduce((sum, r) => sum + parseFloat(r[2].replace(/,/g, '')), 0);
      const totalOther = rows.reduce((sum, r) => sum + parseFloat(r[3].replace(/,/g, '')), 0);
      
      rows.push([]);
      rows.push([
        "GRAND TOTAL",
        formatMoney(totalMonthly),
        formatMoney(totalFood),
        formatMoney(totalOther),
        formatMoney(totalMonthly + totalFood + totalOther)
      ]);

      downloadCsv(`paid_${currentSearch.student_id}.csv`, headers, rows);
      return;
    }

    const headers = [
      "ID No",
      "Name",
      "Monthly Fee",
      "Food Fee",
      "Other Fee",
      "Month Details",
      "Total",
    ];
    const rows = [];
    currentGroups.forEach((group) => {
      (group.rows || []).forEach((row) => {
        const total =
          (row.total_monthly_fee || 0) +
          (row.total_food_fee || 0) +
          (row.total_other_fee || 0);

        rows.push([
          row.student_id,
          row.name,
          formatMoney(row.total_monthly_fee),
          formatMoney(row.total_food_fee),
          formatMoney(row.total_other_fee),
          formatMonthFees(row.month_fees),
          formatMoney(total),
        ]);
      });
    });
    downloadCsv("paid_list.csv", headers, rows);
  });
  document.getElementById("paidExportTxt").addEventListener("click", () => {
    const params = new URLSearchParams();
    const search = searchEl.value.trim();
    if (search) {
      params.set("search", search);
    } else {
      if (classEl.value !== "All") {
        params.set("class", classEl.value);
      }
      if (monthEl.value !== "All") {
        params.set("month", monthEl.value);
      }
    }
    downloadFile(`/api/reports/paid/txt?${params.toString()}`, "paid_list.txt");
  });
  document
    .getElementById("paidPrint")
    .addEventListener("click", () => window.print());
  classEl.addEventListener("change", loadPaid);
  monthEl.addEventListener("change", loadPaid);
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPaid, 200);
  });

  await loadPaid();
}

async function renderUnpaid() {
  pageEl.innerHTML = `
    <h1 class="title">Unpaid List</h1>
    ${buildCard(`
      <div class="row">
        <label>Class</label>
        <select id="unpaidClass">${buildSelectOptions(
          ["All", ...state.classes],
          "All"
        )}</select>
        <label>Month</label>
        <select id="unpaidMonth">${buildSelectOptions(
          ["All", ...state.months],
          "All"
        )}</select>
        <label>Search</label>
        <input type="text" id="unpaidSearch" placeholder="Search by ID or Name" />
      </div>
    `)}
    <div class="button-row" style="margin: 8px 20px;">
      <button class="secondary" id="unpaidRefresh">Refresh</button>
      <button class="secondary" id="unpaidFeeSettings">Fee Settings</button>
      <button class="secondary" id="unpaidExportCsv">Export CSV</button>
      <button class="secondary" id="unpaidExportTxt">Export TXT</button>
      <button class="secondary" id="unpaidPrint">Print</button>
    </div>
    <div class="helper-text" id="unpaidPrintMeta"></div>
    <div id="unpaidTable"></div>
  `;

  const classEl = document.getElementById("unpaidClass");
  const monthEl = document.getElementById("unpaidMonth");
  const searchEl = document.getElementById("unpaidSearch");
  const tableEl = document.getElementById("unpaidTable");
  const printMetaEl = document.getElementById("unpaidPrintMeta");
  let currentGroups = [];
  let currentSearch = null;

  async function loadUnpaid() {
    if (printMetaEl) {
      printMetaEl.textContent = formatPrintMeta();
    }
    const params = new URLSearchParams();
    const search = searchEl.value.trim();
    if (search) {
      params.set("search", search);
    } else {
      if (classEl.value !== "All") {
        params.set("class", classEl.value);
      }
      if (monthEl.value !== "All") {
        params.set("month", monthEl.value);
      }
    }
    try {
      const data = await apiGet(`/api/payments/unpaid?${params.toString()}`);
      currentSearch = data?.search || null;
      if (search) {
        currentGroups = [];
        if (!currentSearch) {
          tableEl.innerHTML = buildCard(
            `<div class="helper-text">No student found.</div>`
          );
          return;
        }

        const paidMonths =
          currentSearch.paid_months ||
          (currentSearch.months || [])
            .map((monthData, index) => {
              const hasPayment =
                (monthData.monthly_fee || 0) > 0 ||
                (monthData.food_fee || 0) > 0 ||
                (monthData.other_fee || 0) > 0;
              return hasPayment ? index + 1 : null;
            })
            .filter((value) => value !== null);
        const months = currentSearch.months || [];
        const totalMonthly = months.reduce((sum, item) => sum + (item.monthly_fee || 0), 0);
        const totalFood = months.reduce((sum, item) => sum + (item.food_fee || 0), 0);
        const totalOther = months.reduce((sum, item) => sum + (item.other_fee || 0), 0);
        const total = totalMonthly + totalFood + totalOther;
        const paidCount = paidMonths.length;
        const unpaidCount = 12 - paidCount;

        let html = `
          <div class="class-section">
            <div class="card tight" style="margin: 10px 0;">
              <div class="grid two" style="padding: 15px;">
                <div>
                  <p><strong>ID:</strong> ${currentSearch.student_id}</p>
                  <p><strong>Name:</strong> ${currentSearch.name}</p>
                  <p><strong>Class:</strong> ${currentSearch.class || 'N/A'}</p>
                  <p><strong>Mobile:</strong> ${currentSearch.mobile || 'N/A'}</p>
                </div>
                <div>
                  <p><strong style="color: green;">Paid Months:</strong> ${paidCount}/12</p>
                  <p><strong style="color: red;">Unpaid Months:</strong> ${unpaidCount}/12</p>
                </div>
              </div>
            </div>
            <h3>Payment Status - ${currentSearch.name}</h3>
        `;

        const monthHeaders = ["Month", "Monthly Fee", "Food Fee", "Other Fee", "Status", "Total"];
        const monthRows = months.map((monthData, index) => {
          const monthNum = index + 1;
          const monthly = monthData.monthly_fee || 0;
          const food = monthData.food_fee || 0;
          const other = monthData.other_fee || 0;
          const monthTotal = monthly + food + other;
          const status = paidMonths.includes(monthNum) ? "Paid" : "Unpaid";
          const statusColor = status === "Paid" ? "green" : "red";
          
          return [
            monthData.month,
            monthly > 0 ? formatMoney(monthly) : "-",
            food > 0 ? formatMoney(food) : "-",
            other > 0 ? formatMoney(other) : "-",
            `<span style="color: ${statusColor}; font-weight: bold;">${status}</span>`,
            monthTotal > 0 ? formatMoney(monthTotal) : "-"
          ];
        });

        html += buildTable(monthHeaders, monthRows);

        html += `
            <div class="card tight" style="margin: 10px 0; background: #c8e6c9;">
              <div class="row space-between" style="padding: 10px;">
                <strong>TOTAL:</strong>
                <span>Monthly: ${formatMoney(totalMonthly)}</span>
                <span>Food: ${formatMoney(totalFood)}</span>
                <span>Other: ${formatMoney(totalOther)}</span>
                <span>Grand Total: ${formatMoney(total)}</span>
              </div>
            </div>
          </div>
        `;

        tableEl.innerHTML = html;
        
        const tbody = tableEl.querySelector("tbody");
        if (tbody) {
          Array.from(tbody.rows).forEach((tr, idx) => {
            const statusCell = tr.cells[4];
            if (statusCell && statusCell.innerHTML.includes("Unpaid")) {
              tr.style.background = "#fff0f0";
            }
          });
        }
        return;
      }

      currentGroups = data?.classes || [];
      const headers = [
        "ID No",
        "Name",
        "Monthly Fee",
        "Food Fee",
        "Other Fee",
        "Paid Months",
        "Total",
      ];
      tableEl.innerHTML = buildClassTables(currentGroups, headers, (row) => {
        const paidCount = (row.months || []).length;
        const total =
          (row.total_monthly_fee || 0) +
          (row.total_food_fee || 0) +
          (row.total_other_fee || 0);
        
        return [
          row.student_id,
          row.name,
          formatMoney(row.total_monthly_fee),
          formatMoney(row.total_food_fee),
          formatMoney(row.total_other_fee),
          `${paidCount}/12 months`,
          formatMoney(total),
        ];
      });

      const sections = tableEl.querySelectorAll(".class-section");
      sections.forEach((section, sectionIndex) => {
        const group = currentGroups[sectionIndex];
        const tbody = section.querySelector("tbody");
        if (tbody) {
          Array.from(tbody.rows).forEach((tr, idx) => {
            applyClassRowStyle(tr, group.class, idx % 2 === 0);
            const paidCell = tr.cells[5];
            if (paidCell) {
              const paidText = paidCell.textContent;
              const paidCount = parseInt(paidText);
              if (paidCount < 12) {
                tr.style.background = mixColors(tr.style.background, "#ffebee", 0.3);
              }
            }
          });
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  document.getElementById("unpaidRefresh").addEventListener("click", loadUnpaid);
  document.getElementById("unpaidExportCsv").addEventListener("click", () => {
    if (currentSearch) {
      const headers = ["Month", "Monthly Fee", "Food Fee", "Other Fee", "Status", "Total"];
      const rows = (currentSearch.months || []).map((monthData, index) => {
        const monthNum = index + 1;
        const monthly = monthData.monthly_fee || 0;
        const food = monthData.food_fee || 0;
        const other = monthData.other_fee || 0;
        const status = (currentSearch.paid_months || []).includes(monthNum) ? "Paid" : "Unpaid";
        
        return [
          monthData.month,
          monthly > 0 ? formatMoney(monthly) : "-",
          food > 0 ? formatMoney(food) : "-",
          other > 0 ? formatMoney(other) : "-",
          status,
          formatMoney(monthly + food + other)
        ];
      });

      const totalMonthly = rows.reduce((sum, r) => sum + parseFloat(r[1].replace(/,/g, '') || 0), 0);
      const totalFood = rows.reduce((sum, r) => sum + parseFloat(r[2].replace(/,/g, '') || 0), 0);
      const totalOther = rows.reduce((sum, r) => sum + parseFloat(r[3].replace(/,/g, '') || 0), 0);
      
      rows.push([]);
      rows.push([
        "GRAND TOTAL",
        formatMoney(totalMonthly),
        formatMoney(totalFood),
        formatMoney(totalOther),
        "",
        formatMoney(totalMonthly + totalFood + totalOther)
      ]);

      downloadCsv(`unpaid_${currentSearch.student_id}.csv`, headers, rows);
      return;
    }

    const headers = [
      "ID No",
      "Name",
      "Monthly Fee",
      "Food Fee",
      "Other Fee",
      "Paid Months",
      "Total",
    ];
    const rows = [];
    currentGroups.forEach((group) => {
      (group.rows || []).forEach((row) => {
        const paidCount = (row.months || []).length;
        const total =
          (row.total_monthly_fee || 0) +
          (row.total_food_fee || 0) +
          (row.total_other_fee || 0);
        
        rows.push([
          row.student_id,
          row.name,
          formatMoney(row.total_monthly_fee),
          formatMoney(row.total_food_fee),
          formatMoney(row.total_other_fee),
          `${paidCount}/12`,
          formatMoney(total),
        ]);
      });
    });
    downloadCsv("unpaid_list.csv", headers, rows);
  });
  document.getElementById("unpaidExportTxt").addEventListener("click", () => {
    const params = new URLSearchParams();
    const search = searchEl.value.trim();
    if (search) {
      params.set("search", search);
    } else {
      if (classEl.value !== "All") {
        params.set("class", classEl.value);
      }
      if (monthEl.value !== "All") {
        params.set("month", monthEl.value);
      }
    }
    downloadFile(`/api/reports/unpaid/txt?${params.toString()}`, "unpaid_list.txt");
  });
  document
    .getElementById("unpaidPrint")
    .addEventListener("click", () => window.print());

  document
    .getElementById("unpaidFeeSettings")
    .addEventListener("click", () => {
      const fee = state.feeSettings || {
        monthly_fee: 0,
        food_fee: 0,
        other_fee: 0,
      };
      openModal(
        "Fee Settings",
        `
        <div class="grid">
          <label>Monthly Fee</label>
          <input type="number" id="feeMonthly" value="${fee.monthly_fee}" />
          <label>Food Fee (Hifz)</label>
          <input type="number" id="feeFood" value="${fee.food_fee}" />
          <label>Other Fee</label>
          <input type="number" id="feeOther" value="${fee.other_fee}" />
          <div class="helper-text">These are default fees for new payments</div>
        </div>
      `,
        [
          {
            label: "Save Fees",
            className: "primary",
            onClick: async () => {
              try {
                const payload = {
                  monthly_fee: parseAmount(
                    document.getElementById("feeMonthly").value
                  ),
                  food_fee: parseAmount(
                    document.getElementById("feeFood").value
                  ),
                  other_fee: parseAmount(
                    document.getElementById("feeOther").value
                  ),
                };
                await apiSend("/api/fee-settings", "POST", payload);
                state.feeSettings = payload;
                showToast("Fees updated.", "success");
                closeModal();
                loadUnpaid();
              } catch (err) {
                showToast(err.message, "error");
              }
            },
          },
          { label: "Cancel", className: "secondary", onClick: closeModal },
        ]
      );
    });

  classEl.addEventListener("change", loadUnpaid);
  monthEl.addEventListener("change", loadUnpaid);
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadUnpaid, 200);
  });

  await loadUnpaid();
}

async function renderMonthwise() {
  pageEl.innerHTML = `
    <h1 class="title">Month-wise Payments</h1>
    ${buildCard(`
      <div class="row">
        <label>Class</label>
        <select id="monthwiseClass">${buildSelectOptions(
          ["All", ...state.classes],
          "All"
        )}</select>
        <label>Month</label>
        <select id="monthwiseMonth">${buildSelectOptions(
          ["All", ...state.months],
          "All"
        )}</select>
      </div>
    `)}
    <div class="button-row" style="margin: 8px 20px;">
      <button class="secondary" id="monthwiseRefresh">Refresh</button>
      <button class="secondary" id="monthwiseExportCsv">Export CSV</button>
      <button class="secondary" id="monthwiseExportTxt">Export TXT</button>
      <button class="secondary" id="monthwisePrint">Print</button>
    </div>
    <div id="monthwiseTable"></div>
  `;

  const classEl = document.getElementById("monthwiseClass");
  const monthEl = document.getElementById("monthwiseMonth");
  const tableEl = document.getElementById("monthwiseTable");
  let current = null;

  async function loadMonthwise() {
    const params = new URLSearchParams();
    if (classEl.value !== "All") {
      params.set("class", classEl.value);
    }
    if (monthEl.value !== "All") {
      params.set("month", monthEl.value);
    }
    try {
      const data = await apiGet(`/api/payments/monthwise?${params.toString()}`);
      current = data;
      const months = data.months || [];
      const headers = [
        "ID No",
        "Name",
        "Monthly Fee",
        "Food Fee",
        "Other Fee",
        ...months,
        "Total Due",
      ];
      const rows = (data.rows || []).map((row) => {
        const statusCells = months.map((month) => row.statuses[month] || "");
        return [
          row.student_id,
          row.name,
          formatMoney(row.monthly_fee),
          row.food_display,
          formatMoney(row.other_fee),
          ...statusCells,
          formatMoney(row.total_due),
        ];
      });
      tableEl.innerHTML = buildTable(headers, rows);
      const tbody = tableEl.querySelector("tbody");
      Array.from(tbody.rows).forEach((tr, idx) => {
        applyClassRowStyle(tr, (data.rows || [])[idx]?.class, idx % 2 === 0);
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  document
    .getElementById("monthwiseRefresh")
    .addEventListener("click", loadMonthwise);
  document
    .getElementById("monthwiseExportCsv")
    .addEventListener("click", () => {
      if (!current) return;
      const months = current.months || [];
      const headers = [
        "ID No",
        "Name",
        "Monthly Fee",
        "Food Fee",
        "Other Fee",
        ...months,
        "Total Due",
      ];
      const rows = (current.rows || []).map((row) => {
        const statusCells = months.map((month) => row.statuses[month] || "");
        return [
          row.student_id,
          row.name,
          formatMoney(row.monthly_fee),
          row.food_display,
          formatMoney(row.other_fee),
          ...statusCells,
          formatMoney(row.total_due),
        ];
      });
      downloadCsv("monthwise_view.csv", headers, rows);
    });
  document
    .getElementById("monthwiseExportTxt")
    .addEventListener("click", () => {
      const params = new URLSearchParams();
      if (classEl.value !== "All") {
        params.set("class", classEl.value);
      }
      if (monthEl.value !== "All") {
        params.set("month", monthEl.value);
      }
      downloadFile(
        `/api/reports/monthwise/txt?${params.toString()}`,
        "monthwise_view.txt"
      );
    });
  document
    .getElementById("monthwisePrint")
    .addEventListener("click", () => window.print());

  classEl.addEventListener("change", loadMonthwise);
  monthEl.addEventListener("change", loadMonthwise);

  await loadMonthwise();
}

async function renderRegister() {
  const next = await apiGet("/api/students/next-id");
  pageEl.innerHTML = `
    <h1 class="title">Register New Student</h1>
    ${buildCard(`
      <div class="grid">
        <label>Student ID</label>
        <input type="text" id="regStudentId" readonly value="${next.student_id}" />
        <label>Name</label>
        <input type="text" id="regName" />
        <label>Father's Name</label>
        <input type="text" id="regFather" />
        <label>Address</label>
        <input type="text" id="regAddress" />
        <label>Class</label>
        <select id="regClass">${buildSelectOptions(
          state.classes,
          state.classes[0]
        )}</select>
        <label>Mobile</label>
        <input type="text" id="regMobile" inputmode="numeric" />
        <label>Upload Image (Optional)</label>
        <input type="file" id="regImage" accept="image/*" />
      </div>
    `)}
    <div class="button-row" style="margin: 8px 20px;">
      <button class="primary" id="regSubmit">Add Student</button>
    </div>
  `;

  const mobileInput = document.getElementById("regMobile");
  mobileInput.addEventListener("input", () => {
    const cleaned = sanitizeMobile(mobileInput.value);
    if (mobileInput.value !== cleaned) {
      mobileInput.value = cleaned;
    }
  });

  document.getElementById("regSubmit").addEventListener("click", async () => {
    try {
      const mobileRaw = document.getElementById("regMobile").value.trim();
      const mobile = sanitizeMobile(mobileRaw);
      if (mobile && (mobile.length < 10 || mobile.length > 15)) {
        throw new Error("Mobile number must be 10-15 digits.");
      }
      const payload = {
        student_id: document.getElementById("regStudentId").value,
        name: document.getElementById("regName").value.trim(),
        father_name: document.getElementById("regFather").value.trim(),
        address: document.getElementById("regAddress").value.trim(),
        class: document.getElementById("regClass").value,
        mobile,
      };
      if (!payload.name) {
        throw new Error("Name is required.");
      }
      await apiSend("/api/students", "POST", payload);

      const file = document.getElementById("regImage").files[0];
      if (file) {
        const form = new FormData();
        form.append("image", file);
        await fetch(
          `/api/students/${encodeURIComponent(payload.student_id)}/image`,
          {
            method: "POST",
            body: form,
          }
        );
      }
      showToast("Student added.", "success");
      const nextId = await apiGet("/api/students/next-id");
      document.getElementById("regStudentId").value = nextId.student_id;
      document.getElementById("regName").value = "";
      document.getElementById("regFather").value = "";
      document.getElementById("regAddress").value = "";
      document.getElementById("regMobile").value = "";
      document.getElementById("regImage").value = "";
      document.getElementById("regClass").value = state.classes[0];
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

async function renderPage(page) {
  if (page === "Dashboard") return renderDashboard();
  if (page === "Students") return renderStudents();
  if (page === "Paid") return renderPaid();
  if (page === "Unpaid") return renderUnpaid();
  if (page === "Register") return renderRegister();
  if (page === "Month-wise") return renderMonthwise();
  pageEl.innerHTML = '<h1 class="title">Page Not Found</h1>';
}

async function init() {
  try {
    state.classes = await apiGet("/api/classes");
    state.months = await apiGet("/api/months");
    state.feeSettings = await apiGet("/api/fee-settings");
  } catch (err) {
    showToast(err.message, "error");
  }

  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.addEventListener("click", () => setActivePage(btn.dataset.page));
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    state.sidebarExpanded = !state.sidebarExpanded;
    sidebarEl.classList.toggle("collapsed", !state.sidebarExpanded);
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

  await renderPage(state.activePage);
}

document.addEventListener("DOMContentLoaded", init);

const FIELD_TYPES = [
  { value: "ignore", label: "Bỏ qua", weight: 0 },
  { value: "account_id", label: "Mã tài khoản", weight: 0 },
  { value: "username", label: "Tên đăng nhập", weight: 14 },
  { value: "parent_agent", label: "Đại lý cấp cao", weight: 12 },
  { value: "email", label: "Email", weight: 45 },
  { value: "phone", label: "Số điện thoại", weight: 40 },
  { value: "national_id", label: "CCCD/CMND/Hộ chiếu", weight: 60 },
  { value: "bank_name", label: "Tên ngân hàng", weight: 12 },
  { value: "device_id", label: "Thiết bị / Device ID", weight: 45 },
  { value: "device_type", label: "Loại thiết bị / Browser", weight: 24 },
  { value: "ip", label: "IP", weight: 20 },
  { value: "domain", label: "Tên miền", weight: 16 },
  { value: "bank_account", label: "Tài khoản ngân hàng", weight: 50 },
  { value: "full_name", label: "Họ tên", weight: 18 },
  { value: "dob", label: "Ngày sinh", weight: 18 },
  { value: "address", label: "Địa chỉ", weight: 16 },
  { value: "password_hash", label: "Mật khẩu / Hash", weight: 35 },
];

const state = {
  headers: [],
  rows: [],
  mapping: {},
  groups: [],
  fileType: "f68k",
  dataFilterColumn: "",
  dataFilterValue: "__all",
  sourceName: "",
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  threshold: document.querySelector("#threshold"),
  thresholdValue: document.querySelector("#thresholdValue"),
  moduleSelect: document.querySelector("#moduleSelect"),
  dataFilter: document.querySelector("#dataFilter"),
  minSignals: document.querySelector("#minSignals"),
  patternMinSize: document.querySelector("#patternMinSize"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  autoMapBtn: document.querySelector("#autoMapBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportColorXlsBtn: document.querySelector("#exportColorXlsBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  progressBox: document.querySelector("#progressBox"),
  progressText: document.querySelector("#progressText"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  mappingTable: document.querySelector("#mappingTable"),
  preview: document.querySelector("#preview"),
  results: document.querySelector("#results"),
  searchInput: document.querySelector("#searchInput"),
  rowCount: document.querySelector("#rowCount"),
  groupCount: document.querySelector("#groupCount"),
  linkedCount: document.querySelector("#linkedCount"),
  topScore: document.querySelector("#topScore"),
};

els.threshold.addEventListener("input", () => {
  els.thresholdValue.value = els.threshold.value;
});

els.fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) loadFile(file);
});

["dragenter", "dragover"].forEach((name) => {
  els.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((name) => {
  els.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
});

els.dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) loadFile(file);
});

els.autoMapBtn.addEventListener("click", () => {
  state.mapping = inferMapping(state.headers);
  renderMapping();
});

els.moduleSelect.addEventListener("change", () => {
  state.fileType = els.moduleSelect.value;
  if (!state.headers.length) return;
  state.mapping = inferMapping(state.headers);
  state.groups = [];
  populateDataFilter();
  resetOutputsForModuleChange();
  updateMetrics();
  renderMapping();
  renderPreview();
  showMessage(els.results, moduleReadyMessage());
});

els.analyzeBtn.addEventListener("click", async () => {
  els.analyzeBtn.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.exportColorXlsBtn.disabled = true;
  els.exportJsonBtn.disabled = true;
  showProgress("Đang chuẩn bị", 0);
  state.groups = await analyzeRows();
  renderResults();
  showProgress("Hoàn tất", 100);
  setTimeout(hideProgress, 900);
  els.analyzeBtn.disabled = false;
});

els.exportCsvBtn.addEventListener("click", exportCsv);
els.exportColorXlsBtn.addEventListener("click", exportColoredXls);
els.exportJsonBtn.addEventListener("click", exportJson);
els.searchInput.addEventListener("input", renderResults);
els.dataFilter.addEventListener("change", () => {
  state.dataFilterValue = els.dataFilter.value;
  state.groups = [];
  els.searchInput.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.exportColorXlsBtn.disabled = true;
  els.exportJsonBtn.disabled = true;
  updateMetrics();
  renderPreview();
  showMessage(els.results, "Đã đổi bộ lọc. Bấm phân tích để chạy lại dữ liệu đang chọn.");
});

async function loadFile(file) {
  let parsed;
  state.sourceName = file.name;
  try {
    parsed = await parseFile(file);
  } catch (error) {
    showMessage(els.preview, error.message);
    return;
  }
  if (parsed.length < 2) {
    showMessage(els.preview, "File cần có dòng tiêu đề và ít nhất một dòng dữ liệu.");
    return;
  }

  state.headers = parsed[0].map((cell, index) => String(cell || `cot_${index + 1}`).trim());
  state.rows = parsed
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row, rowIndex) => rowToObject(row, rowIndex));
  state.fileType = detectFileType(state.headers, file.name);
  els.moduleSelect.value = state.fileType;
  state.mapping = inferMapping(state.headers);
  state.groups = [];
  populateDataFilter();

  els.analyzeBtn.disabled = false;
  els.autoMapBtn.disabled = false;
  els.searchInput.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.exportColorXlsBtn.disabled = true;
  els.exportJsonBtn.disabled = true;

  updateMetrics();
  renderMapping();
  renderPreview();
  showMessage(
    els.results,
    moduleReadyMessage()
  );
}

function detectFileType(headers, sourceName = "") {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const normalizedName = normalizeHeader(sourceName);

  if (
    normalizedHeaders[12] === "loailienket" ||
    normalizedHeaders.includes("loailienket") ||
    normalizedHeaders.includes("thongtinlienketcuthe") ||
    normalizedName.includes("doicuoc")
  ) {
    return "wager_link";
  }

  if (normalizedName.includes("fn01")) return "fn01";
  if (normalizedName.includes("f68k") || normalizedHeaders.includes("dangkytenmien")) return "f68k";
  if (normalizedHeaders.includes("diemthuong") && normalizedHeaders.includes("nganhang")) return "fn01";

  return "f68k";
}

function moduleReadyMessage() {
  if (state.fileType === "wager_link") {
    return "Module Đối cược đã sẵn sàng. Bấm phân tích để gom nhóm theo Loại liên kết và Thông tin liên kết cụ thể.";
  }
  if (state.fileType === "fn01") {
    return "Module FN01 đã sẵn sàng. Bấm phân tích để tìm nhóm nghi ngờ theo IP, thiết bị, fingerprint, ngân hàng và tài khoản.";
  }
  return "Module F68K đã sẵn sàng. Bấm phân tích để tìm nhóm nghi ngờ theo IP, thiết bị, domain, ngân hàng và tài khoản.";
}

function resetOutputsForModuleChange() {
  els.searchInput.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.exportColorXlsBtn.disabled = true;
  els.exportJsonBtn.disabled = true;
}

function normalizeHeader(value) {
  return removeVietnameseMarks(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function populateDataFilter() {
  const filterColumn = findDataFilterColumn();
  state.dataFilterColumn = filterColumn;
  state.dataFilterValue = "__all";
  els.dataFilter.innerHTML = `<option value="__all">Tất cả</option>`;

  if (!filterColumn) {
    els.dataFilter.disabled = true;
    return;
  }

  const counts = new Map();
  state.rows.forEach((row) => {
    const raw = String(row[filterColumn] ?? "").trim();
    const value = raw || "__blank";
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const options = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
    .map(([value, count]) => {
      const label = value === "__blank" ? "Trống" : value;
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)} (${count.toLocaleString("vi-VN")})</option>`;
    })
    .join("");

  els.dataFilter.innerHTML = `<option value="__all">Tất cả (${state.rows.length.toLocaleString("vi-VN")})</option>${options}`;
  els.dataFilter.disabled = false;
}

function findDataFilterColumn() {
  const candidates = ["thethanhvien", "thethanhvien", "card", "membercard", "campaign", "chuongtrinh"];
  return state.headers.find((header) => candidates.includes(normalizeHeader(header))) || "";
}

function rowsForCurrentFilter() {
  if (!state.dataFilterColumn || state.dataFilterValue === "__all") return state.rows;
  return state.rows.filter((row) => {
    const value = String(row[state.dataFilterColumn] ?? "").trim() || "__blank";
    return value === state.dataFilterValue;
  });
}

async function parseFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls"].includes(extension)) {
    if (!window.XLSX) {
      throw new Error("Cần kết nối internet lần đầu để tải bộ đọc Excel. Bạn có thể xuất file sang CSV nếu muốn chạy hoàn toàn offline.");
    }
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
  }

  const buffer = await file.arrayBuffer();
  const text = decodeTextFile(buffer);
  const delimiter = detectDelimiter(text);
  return parseDelimited(text, delimiter);
}

function decodeTextFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  }

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;

  const fallbackEncodings = ["windows-1258", "windows-1252"];
  for (const encoding of fallbackEncodings) {
    try {
      const decoded = new TextDecoder(encoding).decode(bytes);
      if (!decoded.includes("\uFFFD")) return decoded;
    } catch {
      // Some browsers may not expose every legacy encoding.
    }
  }

  return utf8;
}

function rowToObject(row, rowIndex) {
  const record = { __rowNumber: rowIndex + 2 };
  state.headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });
  return record;
}

function detectDelimiter(text) {
  const candidates = [",", "\t", ";", "|"];
  const sampleRows = parseDelimitedPreview(text, 12);
  return candidates
    .map((delimiter) => {
      const counts = sampleRows.map((line) => countDelimiterOutsideQuotes(line, delimiter));
      const usableCounts = counts.filter((count) => count > 0);
      const average = usableCounts.reduce((sum, count) => sum + count, 0) / Math.max(usableCounts.length, 1);
      const consistency = new Set(usableCounts).size <= 1 ? 1 : 0;
      return { delimiter, score: average + consistency };
    })
    .sort((a, b) => b.score - a.score)[0].delimiter;
}

function parseDelimitedPreview(text, maxRows) {
  const rows = [];
  let line = "";
  let quoted = false;
  let atCellStart = true;

  for (let index = 0; index < text.length && rows.length < maxRows; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        line += char + next;
        index += 1;
      } else if (quoted || atCellStart) {
        quoted = !quoted;
        line += char;
      } else {
        line += char;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (line.trim()) rows.push(line);
      line = "";
      atCellStart = true;
      if (char === "\r" && next === "\n") index += 1;
      continue;
    }

    line += char;
    atCellStart = false;
  }

  if (line.trim() && rows.length < maxRows) rows.push(line);
  return rows;
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let quoted = false;
  let atCellStart = true;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        index += 1;
      } else if (quoted || atCellStart) {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      count += 1;
      atCellStart = true;
      continue;
    }

    atCellStart = false;
  }

  return count;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (quoted || atCellStart) {
        quoted = !quoted;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      atCellStart = true;
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      atCellStart = true;
      continue;
    }

    cell += char;
    atCellStart = false;
  }

  if (quoted) {
    throw new Error("CSV bị lỗi: có ô mở dấu ngoặc kép nhưng chưa đóng. Hãy kiểm tra lại dấu \" trong file.");
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => String(item).trim() !== ""));
}

function inferMapping(headers) {
  const patterns = [
    ["username", /^tài khoản thành viên$|^tai khoan thanh vien$|username|login|tên.?đăng.?nhập|ten.?dang.?nhap/i],
    ["account_id", /^id$|account.?id|user.?id|mã.?tài.?khoản|ma.?tai.?khoan/i],
    ["parent_agent", /đại.?lý.?cấp.?cao|dai.?ly.?cap.?cao|agent|affiliate|đại.?lý|dai.?ly/i],
    ["email", /e-?mail|mail|email_address/i],
    ["phone", /phone|mobile|tel|sdt|dien.?thoai|điện.?thoại/i],
    ["national_id", /cccd|cmnd|passport|identity|national|id.?card|can.?cuoc|căn.?cước/i],
    ["bank_name", /^tên ngân hàng$|^ten ngan hang$|bank.?name|ngân.?hàng|ngan.?hang/i],
    ["device_id", /fingerprint|imei|serial|uuid|gaid|idfa|dấu.?vân.?tay|dau.?van.?tay|số.?thiết.?bị|so.?thiet.?bi/i],
    ["device_type", /loại.?thiết.?bị|loai.?thiet.?bi|device.?type|browser|chrome|safari|opera|brave|edge|android|ios|windows/i],
    ["ip", /^ip$|ip.?address|login.?ip|register.?ip/i],
    ["domain", /domain|tên.?miền|ten.?mien/i],
    ["bank_account", /stk|account.?number|so.?tai.?khoan|số.?tài.?khoản/i],
    ["full_name", /^tên$|^ten$|full.?name|ho.?ten|họ.?tên|customer/i],
    ["dob", /dob|birth|birthday|ngay.?sinh|ngày.?sinh/i],
    ["address", /address|addr|dia.?chi|địa.?chỉ|location/i],
    ["password_hash", /password|pass|pwd|hash/i],
  ];

  return Object.fromEntries(
    headers.map((header) => {
      const normalizedHeader = removeVietnameseMarks(header);
      const match = patterns.find(([, regex]) => regex.test(header) || regex.test(normalizedHeader));
      return [header, match ? match[0] : "ignore"];
    })
  );
}

function renderMapping() {
  if (!state.headers.length) {
    showMessage(els.mappingTable, "Chưa có file dữ liệu.");
    return;
  }

  const options = FIELD_TYPES.map(
    (type) => `<option value="${type.value}">${escapeHtml(type.label)}</option>`
  ).join("");

  els.mappingTable.classList.remove("empty-state");
  els.mappingTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cột</th>
          <th>Loại dữ liệu</th>
          <th>Mẫu dữ liệu</th>
        </tr>
      </thead>
      <tbody>
        ${state.headers
          .map((header) => {
            const sample = state.rows
              .slice(0, 5)
              .map((row) => row[header])
              .filter(Boolean)
              .slice(0, 3)
              .join(" | ");
            return `
              <tr>
                <td><strong>${escapeHtml(header)}</strong></td>
                <td>
                  <select data-column="${escapeHtml(header)}">
                    ${options}
                  </select>
                </td>
                <td class="sample-cell">${escapeHtml(sample || "-")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  els.mappingTable.querySelectorAll("select").forEach((select) => {
    const column = select.dataset.column;
    select.value = state.mapping[column] || "ignore";
    select.addEventListener("change", () => {
      state.mapping[column] = select.value;
    });
  });
}

function renderPreview() {
  const previewRows = rowsForCurrentFilter();
  if (!previewRows.length) {
    showMessage(els.preview, "Chưa có dữ liệu.");
    return;
  }

  els.preview.classList.remove("empty-state");
  els.preview.innerHTML = `
    <table>
      <thead>
        <tr>${state.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${previewRows
          .slice(0, 20)
          .map(
            (row) => `
              <tr>
                ${state.headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function analyzeRows() {
  if (state.fileType === "wager_link") {
    return analyzeWagerLinkRows();
  }
  if (state.fileType === "fn01") {
    return analyzeFn01Rows();
  }

  return analyzeF68kRows();
}

async function analyzeF68kRows() {
  return analyzeAccountRows("F68K");
}

async function analyzeFn01Rows() {
  return analyzeAccountRows("FN01");
}

async function analyzeAccountRows(moduleName) {
  const sourceRows = rowsForCurrentFilter();
  const normalized = sourceRows.map((row) => normalizeRow(row));
  const links = [];
  const threshold = Number(els.threshold.value);
  const minSignals = Number(els.minSignals.value);
  showProgress(`Module ${moduleName}: đang tạo cặp ứng viên`, 5);
  await waitFrame();
  const candidatePairs = buildCandidatePairsFast(normalized);
  const pairList = [...candidatePairs];
  showProgress(`Đang so sánh 0/${pairList.length}`, 10);

  for (let index = 0; index < pairList.length; index += 1) {
    const pairKey = pairList[index];
    const [left, right] = pairKey.split(":").map(Number);
    const result = compareRows(normalized[left], normalized[right]);
    if (result.score >= threshold && result.signals.length >= minSignals) {
      links.push({ left, right, ...result });
    }
    if (index % 1000 === 0) {
      const progress = 10 + Math.round((index / Math.max(pairList.length, 1)) * 55);
      showProgress(`Đang so sánh ${index.toLocaleString("vi-VN")}/${pairList.length.toLocaleString("vi-VN")}`, progress);
      await waitFrame();
    }
  }

  showProgress("Đang gom nhóm", 70);
  await waitFrame();
  const components = buildComponents(normalized.length, links);
  const pairGroups = components
    .filter((component) => component.members.length > 1)
    .map((component, index) => summarizeGroup(index + 1, component, links, normalized))
    .sort((a, b) => b.maxScore - a.maxScore || b.members.length - a.members.length);

  showProgress("Đang áp dụng mẫu nhân viên", 82);
  await waitFrame();
  const patternGroups = buildStaffPatternGroupsFast(normalized, pairGroups.length + 1);
  const usernameStyleGroups = buildUsernameStyleGroupsFast(normalized, pairGroups.length + patternGroups.length + 1);
  showProgress("Đang hiệu chỉnh rủi ro", 92);
  await waitFrame();
  return dedupeGroups([...pairGroups, ...patternGroups, ...usernameStyleGroups])
    .map(addUsernamePatternInsights)
    .map(calibrateGroupRisk)
    .filter(groupMeetsMinimumSignalCount)
    .sort((a, b) => b.maxScore - a.maxScore || b.members.length - a.members.length);
}

function showProgress(text, percent) {
  els.progressBox.hidden = false;
  els.progressText.textContent = text;
  els.progressPercent.textContent = `${Math.max(0, Math.min(100, percent))}%`;
  els.progressBar.value = Math.max(0, Math.min(100, percent));
}

function hideProgress() {
  els.progressBox.hidden = true;
}

function waitFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function analyzeWagerLinkRows() {
  showProgress("Đang tổng hợp thông tin liên kết", 20);
  await waitFrame();

  const linkColumn = state.headers[12];
  const detailColumn = state.headers[13];
  const nameColumn = findHeaderByNormalized("hotenthat");
  const accounts = new Map();

  rowsForCurrentFilter().forEach((row) => {
    const account = String(row[state.headers[0]] || "").trim();
    const linkType = String(row[linkColumn] || "").trim();
    const linkDetail = String(row[detailColumn] || "").trim();
    if (!account || !linkType) return;
    const linkKind = wagerLinkKind(linkType);
    const linkValue = normalizeWagerLinkDetail(linkDetail);
    if (!linkKind || !linkValue) return;
    if (!accounts.has(account)) {
      accounts.set(account, {
        row: {
          ...row,
          ho_ten_khong_space: normalizeRealNameNoSpace(row[nameColumn]),
        },
        values: {},
      });
    }
    const record = accounts.get(account);
    record.values[linkKind] ||= new Set();
    record.values[linkKind].add(linkValue);
  });

  showProgress("Đang tạo nhóm 2 điều kiện", 70);
  await waitFrame();

  const pairBuckets = new Map();
  const pairs = [
    ["mkrt", "mkdn"],
    ["mkrt", "ip"],
    ["mkdn", "ip"],
    ["device", "ip"],
    ["device", "mkrt"],
    ["device", "mkdn"],
  ];

  accounts.forEach((record) => {
    pairs.forEach(([leftKind, rightKind]) => {
      const leftValues = record.values[leftKind];
      const rightValues = record.values[rightKind];
      if (!leftValues || !rightValues) return;
      leftValues.forEach((leftValue) => {
        rightValues.forEach((rightValue) => {
          const key = `${leftKind}:${leftValue}::${rightKind}:${rightValue}`;
          if (!pairBuckets.has(key)) {
            pairBuckets.set(key, {
              leftKind,
              leftValue,
              rightKind,
              rightValue,
              members: new Map(),
            });
          }
          pairBuckets.get(key).members.set(record.row[state.headers[0]], record.row);
        });
      });
    });
  });

  let groupId = 1;
  return [...pairBuckets.values()]
    .map((bucket) => ({ ...bucket, members: [...bucket.members.values()] }))
    .filter((bucket) => bucket.members.length > 1)
    .sort((a, b) => b.members.length - a.members.length || wagerKindLabel(a.leftKind).localeCompare(wagerKindLabel(b.leftKind), "vi"))
    .map((bucket) => ({
      id: groupId++,
      source: "Đối cược - 2 điều kiện",
      recommendation: moduleRecommendation("wagerLink"),
      maxScore: 0,
      members: bucket.members,
      links: [],
      signals: [
        {
          type: "wager_link_type",
          label: "Điều kiện 1",
          value: `${wagerKindLabel(bucket.leftKind)}: ${bucket.leftValue}`,
          similarity: 1,
          weight: 0,
        },
        {
          type: "wager_link_detail",
          label: "Điều kiện 2",
          value: `${wagerKindLabel(bucket.rightKind)}: ${bucket.rightValue}`,
          similarity: 1,
          weight: 0,
        },
      ],
    }));
}

function wagerLinkKind(value) {
  const normalized = normalizeHeader(value);
  if (normalized === "cungip") return "ip";
  if (normalized === "cungmasothietbi") return "device";
  if (normalized === "cungmatkhauruttienmat") return "mkrt";
  if (normalized === "cungmatkhaudangnhap" || normalized === "cungmatkhauangnhap") return "mkdn";
  return "";
}

function wagerKindLabel(kind) {
  return {
    ip: "IP",
    device: "Mã thiết bị",
    mkrt: "Mật khẩu rút tiền",
    mkdn: "Mật khẩu đăng nhập",
  }[kind] || kind;
}

function normalizeWagerLinkDetail(value) {
  return String(value || "")
    .trim()
    .replace(/^[^:：]+[:：]\s*/, "")
    .replace(/\s+/g, " ");
}

function findHeaderByNormalized(normalizedName) {
  return state.headers.find((header) => normalizeHeader(header) === normalizedName) || "";
}

function normalizeRealNameNoSpace(value) {
  return removeVietnameseMarks(String(value || ""))
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeRow(row) {
  const values = {};
  for (const [column, type] of Object.entries(state.mapping)) {
    if (type === "ignore") continue;
    const raw = String(row[column] ?? "").trim();
    if (!raw) continue;
    values[type] ||= [];
    values[type].push({
      column,
      raw,
      normalized: normalizeValue(raw, type),
    });
  }
  return { row, values };
}

function normalizeValue(value, type) {
  const base = removeVietnameseMarks(value).toLowerCase().trim();
  if (type === "email") return base;
  if (type === "phone") return normalizePhone(base);
  if (["national_id", "bank_account"].includes(type)) return base.replace(/\D/g, "");
  if (type === "username") return normalizeUsername(base);
  if (type === "ip") return base.replace(/\s/g, "");
  if (type === "domain") return base.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (type === "bank_name") return normalizeBankName(base);
  if (type === "device_type") return base.replace(/\s+/g, " ");
  if (type === "dob") return normalizeDate(base);
  if (type === "address") return base.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  return base.replace(/[^\p{L}\p{N}@._-]+/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizeBankName(value) {
  const compact = value.replace(/[^a-z0-9]/g, "");
  const aliases = [
    [/^mb(bank)?$/, "mbbank"],
    [/^vietcom(b|bank)?$/, "vietcombank"],
    [/^techcom(b|bank)?$/, "techcombank"],
    [/^vietin(ba|bank)?$/, "vietinbank"],
  ];
  const match = aliases.find(([regex]) => regex.test(compact));
  return match ? match[1] : compact;
}

function normalizeUsername(value) {
  return value.replace(/[^a-z0-9._-]/g, "");
}

function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizeDate(value) {
  const parts = value.match(/\d+/g) || [];
  if (parts.length < 3) return value;
  let [first, second, third] = parts;
  if (first.length === 4) return `${first}-${second.padStart(2, "0")}-${third.padStart(2, "0")}`;
  return `${third.padStart(4, "0")}-${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
}

function removeVietnameseMarks(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function compareRows(left, right) {
  const signals = [];
  let score = 0;
  const strongSignals = new Set(["email", "phone", "national_id", "device_id", "ip", "bank_account", "password_hash"]);

  FIELD_TYPES.forEach((field) => {
    if (!field.weight || !left.values[field.value] || !right.values[field.value]) return;
    const match = bestMatch(left.values[field.value], right.values[field.value], field.value);
    if (!match) return;
    signals.push({
      type: field.value,
      label: field.label,
      value: match.value,
      similarity: match.similarity,
      weight: field.weight,
    });
    score += Math.round(field.weight * match.similarity);
  });

  const hasStrongSignal = signals.some((signal) => strongSignals.has(signal.type));
  const weakScore = signals.reduce((total, signal) => {
    return total + (strongSignals.has(signal.type) ? 0 : Math.round(signal.weight * signal.similarity));
  }, 0);
  const cappedScore = hasStrongSignal ? score : Math.min(score, 45);

  return { score: Math.min(cappedScore, 100), weakScore, signals };
}

function buildStaffPatternGroups(normalized, startId) {
  const buckets = new Map();
  const minSize = Math.max(3, Number(els.patternMinSize.value) || 5);
  const prefixLength = 4;
  normalized.forEach((item, rowIndex) => {
    const banks = valuesFor(item, "bank_name");
    const bankAccounts = valuesFor(item, "bank_account");
    const domains = valuesFor(item, "domain");
    const devices = valuesFor(item, "device_type");
    const agents = valuesFor(item, "parent_agent");

    banks.forEach((bank) => {
      bankAccounts.forEach((account) => {
        const prefix = accountPrefix(account.normalized, prefixLength);
        if (!prefix) return;

        domains.forEach((domain) => {
          devices.forEach((device) => {
            const browserGroup = classifyBrowserGroup(device.normalized);
            addPatternBucket(
              buckets,
              [
                "staff-pattern",
                agents[0]?.normalized || "all-agents",
                bank.normalized,
                prefix,
                domain.normalized,
                device.normalized,
              ],
              rowIndex,
              [
                signalFromValue("bank_name", "Tên ngân hàng", bank),
                { type: "bank_prefix", label: "Đầu số tài khoản", value: prefix, similarity: 1, weight: 0 },
                signalFromValue("domain", "Tên miền", domain),
                signalFromValue("device_type", "Loại thiết bị", device),
                ...(agents[0] ? [signalFromValue("parent_agent", "Đại lý cấp cao", agents[0])] : []),
              ],
              browserGroup ? { riskBrowser: browserGroup } : {}
            );

            if (browserGroup) {
              addPatternBucket(
                buckets,
                ["danger-browser", browserGroup, bank.normalized, prefix, domain.normalized],
                rowIndex,
                [
                  { type: "risk_browser", label: "Browser nguy hiểm", value: browserGroup, similarity: 1, weight: 0 },
                  signalFromValue("bank_name", "Tên ngân hàng", bank),
                  { type: "bank_prefix", label: "Đầu số tài khoản", value: prefix, similarity: 1, weight: 0 },
                  signalFromValue("domain", "Tên miền", domain),
                ],
                { riskBrowser: browserGroup, danger: true }
  );
}

function buildCandidatePairs(normalized) {
  const buckets = new Map();
  const pairKeys = new Set();
  const exactTypes = ["email", "phone", "national_id", "device_id", "ip", "password_hash"];

  normalized.forEach((item, rowIndex) => {
    exactTypes.forEach((type) => {
      valuesFor(item, type).forEach((value) => {
        addCandidateBucket(buckets, `${type}:${value.normalized}`, rowIndex);
      });
    });

    const banks = valuesFor(item, "bank_name");
    const bankAccounts = valuesFor(item, "bank_account");
    const domains = valuesFor(item, "domain");
    const devices = valuesFor(item, "device_type");

    banks.forEach((bank) => {
      bankAccounts.forEach((account) => {
        const prefix = accountPrefix(account.normalized, 4);
        if (!prefix) return;
        addCandidateBucket(buckets, `bank_prefix:${bank.normalized}:${prefix}`, rowIndex);

        domains.forEach((domain) => {
          devices.forEach((device) => {
            addCandidateBucket(
              buckets,
              `staff:${bank.normalized}:${prefix}:${domain.normalized}:${device.normalized}`,
              rowIndex
            );
          });
        });
      });
    });
  });

  buckets.forEach((members) => {
    if (members.length < 2 || members.length > 400) return;
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        pairKeys.add(`${members[i]}:${members[j]}`);
      }
    }
  });

  return pairKeys;
}

function addCandidateBucket(buckets, key, rowIndex) {
  if (!key || key.endsWith(":")) return;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(rowIndex);
}
          });
        });
      });
    });
  });

  let nextId = startId;
  return [...buckets.values()]
    .filter((bucket) => bucket.members.size >= minSize)
    .map((bucket) => {
      const members = [...bucket.members].map((index) => normalized[index].row);
      const maxScore = bucket.danger
        ? 100
        : Math.min(92, 54 + Math.min(20, members.length * 2) + bucket.signals.length * 3);
      return {
        id: nextId++,
        source: bucket.danger ? "Browser nguy hiểm" : "Mẫu nhân viên",
        recommendation: bucket.danger
          ? moduleRecommendation("dangerBrowser")
          : moduleRecommendation("staffPattern"),
        maxScore,
        members,
        links: [],
        signals: [...bucket.signals.values()],
      };
    });
}

function calibrateGroupRisk(group) {
  const memberCount = group.members.length;
  const hasDangerBrowser = group.signals.some((signal) => signal.type === "risk_browser");
  const hasHardIdentity = group.signals.some((signal) =>
    ["national_id", "device_id", "phone", "email", "password_hash"].includes(signal.type)
  );
  const hasExactBankAccount = group.signals.some((signal) => signal.type === "bank_account");

  if (hasDangerBrowser) {
    return {
      ...group,
      source: "Browser nguy hiểm",
      maxScore: 100,
      recommendation: moduleRecommendation("dangerBrowser"),
    };
  }

  if (memberCount >= 50 && !hasHardIdentity && !hasExactBankAccount) {
    return {
      ...group,
      source: "Phổ thông",
      maxScore: Math.min(group.maxScore, 35),
      recommendation: moduleRecommendation("broadCommon"),
    };
  }

  if (memberCount >= 20 && !hasHardIdentity) {
    return {
      ...group,
      source: "Cần lọc thêm",
      maxScore: Math.min(group.maxScore, 55),
      recommendation: moduleRecommendation("broadReview"),
    };
  }

  if (group.source === "Mẫu nhân viên" && memberCount <= 15) {
    return {
      ...group,
      recommendation: moduleRecommendation("smallStaffPattern"),
    };
  }

  return group;
}

function valuesFor(item, type) {
  return item.values[type] || [];
}

function signalFromValue(type, label, value) {
  return { type, label, value: value.raw, similarity: 1, weight: 0 };
}

function accountPrefix(value, length) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < length) return "";
  return digits.slice(0, length);
}

function addPatternBucket(buckets, keyParts, rowIndex, signals, meta = {}) {
  const key = keyParts.join("::");
  if (!buckets.has(key)) {
    buckets.set(key, { members: new Set(), signals: new Map(), ...meta });
  }
  const bucket = buckets.get(key);
  bucket.members.add(rowIndex);
  if (meta.danger) bucket.danger = true;
  if (meta.riskBrowser) bucket.riskBrowser = meta.riskBrowser;
  signals.forEach((signal) => {
    bucket.signals.set(`${signal.type}:${signal.value}`, signal);
  });
}

function classifyBrowserGroup(value) {
  if (/opera|opr\//i.test(value)) return "Opera";
  if (/brave|edge/i.test(value)) return "Brave & Edge";
  return "";
}

function activeModuleLabel() {
  if (state.fileType === "fn01") return "FN01";
  if (state.fileType === "wager_link") return "Đối cược";
  return "F68K";
}

function moduleRecommendation(kind) {
  const moduleLabel = activeModuleLabel();
  const copy = {
    dangerBrowser:
      "Browser rủi ro cao. Ưu tiên kiểm tra cùng IP, fingerprint, thiết bị và giao dịch trong file hiện tại.",
    staffPattern:
      `Cụm cùng ngân hàng, đầu số tài khoản, domain và thiết bị. Ưu tiên rà soát trong module ${moduleLabel}.`,
    broadCommon:
      "Tín hiệu quá phổ biến, chưa đủ kết luận. Cần lọc thêm theo fingerprint, IP, tên, giao dịch hoặc thời gian trong file hiện tại.",
    broadReview:
      "Nhóm khá rộng. Chỉ dùng làm danh sách rà soát thủ công, chưa tự động đưa vào diện xử lý.",
    smallStaffPattern:
      `Nhóm nhỏ cùng ngân hàng, đầu số, domain và thiết bị. Ưu tiên kiểm tra chi tiết trong module ${moduleLabel}.`,
    usernameStyle:
      "Cùng kiểu đặt tên tài khoản. Dùng để rà soát mở rộng, chưa đủ kết luận nếu không có IP, fingerprint, thiết bị hoặc giao dịch đi kèm.",
    wagerLink:
      "Nhóm tài khoản trùng đồng thời 2 loại thông tin liên kết. Dùng họ tên không space và chi tiết liên kết để rà soát trong file Đối cược hiện tại.",
  };
  return copy[kind] || "";
}

function buildStaffPatternGroupsFast(normalized, startId) {
  const buckets = new Map();
  const minSize = Math.max(3, Number(els.patternMinSize.value) || 5);

  normalized.forEach((item, rowIndex) => {
    const banks = valuesFor(item, "bank_name");
    const bankAccounts = valuesFor(item, "bank_account");
    const domains = valuesFor(item, "domain");
    const devices = valuesFor(item, "device_type");
    const agents = valuesFor(item, "parent_agent");

    banks.forEach((bank) => {
      bankAccounts.forEach((account) => {
        const prefix = accountPrefix(account.normalized, 4);
        if (!prefix) return;

        domains.forEach((domain) => {
          devices.forEach((device) => {
            const browserGroup = classifyBrowserGroup(device.normalized);
            addPatternBucket(
              buckets,
              ["staff-pattern", agents[0]?.normalized || "all-agents", bank.normalized, prefix, domain.normalized, device.normalized],
              rowIndex,
              [
                signalFromValue("bank_name", "Tên ngân hàng", bank),
                { type: "bank_prefix", label: "Đầu số tài khoản", value: prefix, similarity: 1, weight: 0 },
                signalFromValue("domain", "Tên miền", domain),
                signalFromValue("device_type", "Loại thiết bị", device),
                ...(agents[0] ? [signalFromValue("parent_agent", "Đại lý cấp cao", agents[0])] : []),
              ],
              browserGroup ? { riskBrowser: browserGroup } : {}
            );

            if (browserGroup) {
              addPatternBucket(
                buckets,
                ["danger-browser", browserGroup, bank.normalized, prefix, domain.normalized],
                rowIndex,
                [
                  { type: "risk_browser", label: "Browser nguy hiểm", value: browserGroup, similarity: 1, weight: 0 },
                  signalFromValue("bank_name", "Tên ngân hàng", bank),
                  { type: "bank_prefix", label: "Đầu số tài khoản", value: prefix, similarity: 1, weight: 0 },
                  signalFromValue("domain", "Tên miền", domain),
                ],
                { riskBrowser: browserGroup, danger: true }
              );
            }
          });
        });
      });
    });
  });

  let nextId = startId;
  return [...buckets.values()]
    .filter((bucket) => bucket.members.size >= minSize)
    .map((bucket) => {
      const members = [...bucket.members].map((index) => normalized[index].row);
      return {
        id: nextId++,
        source: bucket.danger ? "Browser nguy hiểm" : "Mẫu nhân viên",
        recommendation: bucket.danger
          ? moduleRecommendation("dangerBrowser")
          : moduleRecommendation("staffPattern"),
        maxScore: bucket.danger ? 100 : Math.min(92, 54 + Math.min(20, members.length * 2) + bucket.signals.size * 3),
        members,
        links: [],
        signals: [...bucket.signals.values()],
      };
    });
}

function buildCandidatePairsFast(normalized) {
  const buckets = new Map();
  const pairKeys = new Set();
  const exactTypes = ["email", "phone", "national_id", "device_id", "ip", "password_hash"];

  normalized.forEach((item, rowIndex) => {
    exactTypes.forEach((type) => {
      valuesFor(item, type).forEach((value) => {
        if (value.normalized) addCandidateBucketFast(buckets, `${type}:${value.normalized}`, rowIndex);
      });
    });

    valuesFor(item, "username").forEach((value) => {
      usernameCandidateKeys(value.normalized).forEach((key) => {
        addCandidateBucketFast(buckets, `username:${key}`, rowIndex);
      });
    });
  });

  buckets.forEach((members) => {
    const uniqueMembers = [...new Set(members)];
    if (uniqueMembers.length < 2 || uniqueMembers.length > 120) return;
    for (let i = 0; i < uniqueMembers.length; i += 1) {
      for (let j = i + 1; j < uniqueMembers.length; j += 1) {
        pairKeys.add(`${uniqueMembers[i]}:${uniqueMembers[j]}`);
      }
    }
  });

  return pairKeys;
}

function usernameCandidateKeys(value) {
  const parsed = parseUsername(value);
  const keys = [];
  if (parsed.prefix.length >= 5) keys.push(`prefix:${parsed.prefix}`);
  if (parsed.prefix.length >= 4 && parsed.number) keys.push(`prefix-num:${parsed.prefix}:${parsed.number.slice(0, 2)}`);
  if (parsed.shape.length >= 5) keys.push(`shape:${parsed.shape}`);
  return keys;
}

function buildUsernameStyleGroupsFast(normalized, startId) {
  const buckets = new Map();
  const minSize = Math.max(5, Number(els.patternMinSize.value) || 5);

  normalized.forEach((item, rowIndex) => {
    const usernames = valuesFor(item, "username");
    const banks = valuesFor(item, "bank_name");
    const domains = valuesFor(item, "domain");
    usernames.forEach((username) => {
      const parsed = parseUsername(username.normalized);
      if (!isVietnameseNameNumberPattern(parsed)) return;
      const token = primaryVietnameseNameToken(parsed.alpha);
      if (!token) return;
      const numberLength = parsed.number.length >= 8 ? "8+" : `${parsed.number.length}`;
      const bankKeys = banks.length ? banks.map((bank) => bank.normalized) : ["all-banks"];
      const domainKeys = domains.length ? domains.map((domain) => domain.normalized) : ["all-domains"];

      bankKeys.forEach((bank) => {
        domainKeys.forEach((domain) => {
          addPatternBucket(
            buckets,
            ["username-style", bank, domain, token, numberLength],
            rowIndex,
            [
              {
                type: "username_name_number_style",
                label: "Kiểu đặt tên",
                value: `tên Việt viết liền + số dài, token ${token}, ${numberLength} số`,
                similarity: 1,
                weight: 12,
              },
            ]
          );
        });
      });
    });
  });

  let nextId = startId;
  return [...buckets.values()]
    .filter((bucket) => bucket.members.size >= minSize)
    .map((bucket) => {
      const members = [...bucket.members].map((index) => normalized[index].row);
      return {
        id: nextId++,
        source: "Mẫu tên đăng nhập",
        recommendation: moduleRecommendation("usernameStyle"),
        maxScore: Math.min(52, 30 + Math.min(14, members.length) + bucket.signals.size * 4),
        members,
        links: [],
        signals: [...bucket.signals.values()],
      };
    });
}

function addCandidateBucketFast(buckets, key, rowIndex) {
  if (!key || key.endsWith(":")) return;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(rowIndex);
}

function dedupeGroups(groups) {
  const bestByMembers = new Map();
  groups.forEach((group) => {
    const key = group.members.map((row) => row.__rowNumber).sort((a, b) => a - b).join(",");
    const current = bestByMembers.get(key);
    if (!current || group.maxScore > current.maxScore) {
      bestByMembers.set(key, group);
    }
  });
  return [...bestByMembers.values()];
}

function groupMeetsMinimumSignalCount(group) {
  const minSignals = Number(els.minSignals.value) || 3;
  const signalTypes = new Set(group.signals.map((signal) => signal.type));
  return signalTypes.size >= minSignals;
}

function addUsernamePatternInsights(group) {
  const usernameColumns = state.headers.filter((header) => state.mapping[header] === "username");
  if (!usernameColumns.length || group.members.length < 3) return group;

  const usernames = group.members
    .flatMap((row) => usernameColumns.map((column) => String(row[column] || "").trim()))
    .filter(Boolean);
  const insights = analyzeUsernamePatterns(usernames);
  if (!insights.length) return group;

  const existing = new Set(group.signals.map((signal) => `${signal.type}:${signal.value}`));
  const signals = [...group.signals];
  insights.forEach((signal) => {
    const key = `${signal.type}:${signal.value}`;
    if (!existing.has(key)) signals.unshift(signal);
  });

  const bonus = Math.min(8, insights.length * 3);
  const recommendation = group.recommendation
    ? `${group.recommendation} Có mẫu đặt tên tài khoản đáng chú ý.`
    : "Có mẫu đặt tên tài khoản đáng chú ý, nên rà soát cùng các tín hiệu khác.";

  return {
    ...group,
    maxScore: Math.min(100, group.maxScore + bonus),
    recommendation,
    signals,
  };
}

function analyzeUsernamePatterns(usernames) {
  const prefixBuckets = new Map();
  const shapeBuckets = new Map();
  const vietnameseNameNumberItems = [];

  usernames.forEach((username) => {
    const normalized = normalizeUsername(removeVietnameseMarks(username).toLowerCase());
    const parsed = parseUsername(normalized);
    if (parsed.prefix.length >= 4) {
      addToPatternBucket(prefixBuckets, parsed.prefix, { username, number: parsed.number });
    }
    if (parsed.shape.length >= 6) {
      addToPatternBucket(shapeBuckets, parsed.shape, { username, number: parsed.number });
    }
    if (isVietnameseNameNumberPattern(parsed)) {
      vietnameseNameNumberItems.push({ username, ...parsed });
    }
  });

  const insights = [];
  const nameNumberInsight = vietnameseNameNumberInsight(vietnameseNameNumberItems, usernames.length);
  if (nameNumberInsight) insights.push(nameNumberInsight);

  const prefixInsight = bestUsernamePrefixInsight(prefixBuckets);
  if (prefixInsight) insights.push(prefixInsight);

  const shapeInsight = bestUsernameShapeInsight(shapeBuckets);
  if (shapeInsight) insights.push(shapeInsight);

  return insights;
}

function isVietnameseNameNumberPattern(parsed) {
  return parsed.alpha.length >= 4 && parsed.number.length >= 4 && findVietnameseNameTokens(parsed.alpha).length > 0;
}

function vietnameseNameNumberInsight(items, totalCount) {
  const uniqueNames = [...new Set(items.map((item) => item.username))];
  if (uniqueNames.length < 5 || uniqueNames.length / Math.max(totalCount, 1) < 0.35) return null;

  const tokenCounts = new Map();
  const numberLengths = items.map((item) => item.number.length).sort((a, b) => a - b);
  items.forEach((item) => {
    findVietnameseNameTokens(item.alpha).forEach((token) => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
  });

  const topTokens = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token, count]) => `${token}(${count})`)
    .join(", ");
  const minLen = numberLengths[0];
  const maxLen = numberLengths[numberLengths.length - 1];
  const lengthText = minLen === maxLen ? `${minLen} số` : `${minLen}-${maxLen} số`;

  return {
    type: "username_name_number_style",
    label: "Kiểu đặt tên",
    value: `tên Việt viết liền + số dài (${uniqueNames.length} tài khoản, ${lengthText}; nổi bật: ${topTokens})`,
    similarity: 1,
    weight: 12,
  };
}

function findVietnameseNameTokens(alpha) {
  const tokens = [
    "nguyen",
    "tran",
    "le",
    "pham",
    "hoang",
    "huynh",
    "phan",
    "vu",
    "vo",
    "dang",
    "bui",
    "do",
    "dinh",
    "ngo",
    "duong",
    "ly",
    "truong",
    "van",
    "thi",
    "xuan",
    "minh",
    "quang",
    "thanh",
    "hong",
    "thuy",
    "huyen",
    "huong",
    "hang",
    "hoa",
    "hanh",
    "khoa",
    "phuoc",
    "cuong",
    "duong",
    "thai",
    "phuc",
    "truong",
    "ngan",
    "anh",
    "bac",
    "son",
    "long",
    "quan",
  ];
  return tokens.filter((token) => alpha.includes(token));
}

function primaryVietnameseNameToken(alpha) {
  const matches = findVietnameseNameTokens(alpha)
    .map((token) => ({ token, index: alpha.indexOf(token) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index || b.token.length - a.token.length);
  return matches[0]?.token || "";
}

function addToPatternBucket(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function bestUsernamePrefixInsight(prefixBuckets) {
  let best = null;
  prefixBuckets.forEach((items, prefix) => {
    const uniqueNames = [...new Set(items.map((item) => item.username))];
    if (uniqueNames.length < 3) return;
    const numbers = items
      .map((item) => Number(item.number))
      .filter((number) => Number.isFinite(number))
      .sort((a, b) => a - b);
    const closeRuns = countCloseNumberRuns(numbers);
    const score = uniqueNames.length * 2 + closeRuns * 3 + Math.min(prefix.length, 10);
    if (!best || score > best.score) {
      const numberText = numbers.length ? `, số đuôi ${numbers[0]}-${numbers[numbers.length - 1]}` : "";
      best = {
        score,
        signal: {
          type: "username_pattern",
          label: "Mẫu đặt tên",
          value: `${prefix}* (${uniqueNames.length} tài khoản${numberText})`,
          similarity: 1,
          weight: 14,
        },
      };
    }
  });
  return best?.signal || null;
}

function bestUsernameShapeInsight(shapeBuckets) {
  let best = null;
  shapeBuckets.forEach((items, shape) => {
    const uniqueNames = [...new Set(items.map((item) => item.username))];
    if (uniqueNames.length < 5) return;
    const score = uniqueNames.length + shape.length;
    if (!best || score > best.score) {
      best = {
        score,
        signal: {
          type: "username_shape",
          label: "Cấu trúc tên đăng nhập",
          value: `${shape} (${uniqueNames.length} tài khoản)`,
          similarity: 1,
          weight: 10,
        },
      };
    }
  });
  return best?.signal || null;
}

function countCloseNumberRuns(numbers) {
  if (numbers.length < 2) return 0;
  let runs = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    const diff = numbers[index] - numbers[index - 1];
    if (diff > 0 && diff <= 20) runs += 1;
  }
  return runs;
}

function bestMatch(leftValues, rightValues, type) {
  let best = null;
  for (const left of leftValues) {
    for (const right of rightValues) {
      if (!left.normalized || !right.normalized) continue;
      const similarity = valueSimilarity(left.normalized, right.normalized, type);
      if (similarity <= 0) continue;
      if (!best || similarity > best.similarity) {
        best = {
          value: left.normalized === right.normalized ? left.raw : `${left.raw} ~= ${right.raw}`,
          similarity,
        };
      }
    }
  }
  return best;
}

function valueSimilarity(left, right, type) {
  if (type === "bank_account") return left === right && left.length >= 8 ? 1 : 0;
  if (type === "username") return usernameSimilarity(left, right);
  if (left === right) return 1;
  if (["full_name", "address"].includes(type)) return tokenSimilarity(left, right) >= 0.82 ? 0.7 : 0;
  if (type === "email") return emailLocalPart(left) === emailLocalPart(right) ? 0.45 : 0;
  return 0;
}

function usernameSimilarity(left, right) {
  if (!left || !right || left.length < 4 || right.length < 4) return 0;
  if (left === right) return 1;

  const a = parseUsername(left);
  const b = parseUsername(right);
  if (a.prefix.length >= 4 && a.prefix === b.prefix && a.number && b.number) {
    const diff = Math.abs(Number(a.number) - Number(b.number));
    if (Number.isFinite(diff) && diff <= 20) return 0.9;
    return 0.72;
  }

  if (a.prefix.length >= 5 && a.prefix === b.prefix) return 0.7;
  if (a.shape === b.shape && a.shape.length >= 6 && tokenSimilarity(a.alphaChunks, b.alphaChunks) >= 0.5) return 0.55;
  return 0;
}

function parseUsername(value) {
  const clean = String(value || "").toLowerCase();
  const prefix = clean.match(/^[a-z]+/)?.[0] || "";
  const number = clean.match(/\d+$/)?.[0] || "";
  const alpha = clean.replace(/[^a-z]/g, "");
  const alphaChunks = clean.replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
  const shape = clean.replace(/[a-z]+/g, "a").replace(/\d+/g, "9").replace(/[^a9]+/g, "");
  return { prefix, number, alpha, alphaChunks, shape };
}

function emailLocalPart(value) {
  return value.split("@")[0].replace(/[._+-]\d*$/g, "");
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function buildComponents(size, links) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const find = (item) => {
    while (parent[item] !== item) {
      parent[item] = parent[parent[item]];
      item = parent[item];
    }
    return item;
  };
  const unite = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  links.forEach((link) => unite(link.left, link.right));

  const map = new Map();
  for (let index = 0; index < size; index += 1) {
    const root = find(index);
    if (!map.has(root)) map.set(root, []);
    map.get(root).push(index);
  }
  return [...map.values()].map((members) => ({ members }));
}

function summarizeGroup(id, component, links, normalized) {
  const memberSet = new Set(component.members);
  const groupLinks = links.filter((link) => memberSet.has(link.left) && memberSet.has(link.right));
  const maxScore = Math.max(...groupLinks.map((link) => link.score));
  const signalMap = new Map();

  groupLinks.forEach((link) => {
    link.signals.forEach((signal) => {
      const key = `${signal.type}:${signal.value}`;
      if (!signalMap.has(key)) signalMap.set(key, signal);
    });
  });

  return {
    id,
    maxScore,
    members: component.members.map((index) => normalized[index].row),
    links: groupLinks,
    signals: [...signalMap.values()],
  };
}

function renderResults() {
  updateMetrics();
  const query = els.searchInput.value.trim().toLowerCase();
  const filtered = state.groups.filter((group) => {
    if (!query) return true;
    return JSON.stringify(group).toLowerCase().includes(query);
  });

  els.searchInput.disabled = state.groups.length === 0;
  els.exportCsvBtn.disabled = state.groups.length === 0;
  els.exportColorXlsBtn.disabled = state.groups.length === 0;
  els.exportJsonBtn.disabled = state.groups.length === 0;

  if (!filtered.length) {
    showMessage(els.results, state.groups.length ? "Không có nhóm nào khớp từ khóa." : "Không tìm thấy nhóm nghi ngờ theo ngưỡng hiện tại.");
    return;
  }

  els.results.classList.remove("empty-state");
  els.results.innerHTML = filtered.map(renderGroup).join("");
}

function renderGroup(group) {
  const identifierColumns = state.headers.filter((header) => state.mapping[header] === "account_id");
  const displayColumns =
    state.fileType === "wager_link"
      ? [...state.headers.slice(0, 14), "ho_ten_khong_space"]
      : [
          ...identifierColumns,
          ...state.headers.filter((header) => state.mapping[header] !== "ignore" && !identifierColumns.includes(header)),
        ].slice(0, 8);
  const visibleMembers = state.fileType === "wager_link" ? group.members.slice(0, 200) : group.members;
  const hiddenCount = group.members.length - visibleMembers.length;

  return `
    <article class="group-card">
      <div class="group-title">
        <div>
          <strong>Nhóm #${group.id}</strong>
          <span class="muted"> - ${group.members.length} ${state.fileType === "wager_link" ? "dòng" : "tài khoản"}${group.links.length ? `, ${group.links.length} kết nối` : ""}</span>
          ${group.source ? `<span class="source-pill">${escapeHtml(group.source)}</span>` : ""}
        </div>
        <span class="score ${group.maxScore >= 80 ? "risk-high" : group.maxScore >= 60 ? "risk-mid" : ""}">
          ${group.maxScore}
        </span>
      </div>
      ${group.recommendation ? `<div class="recommendation">${escapeHtml(group.recommendation)}</div>` : ""}
      <div class="signal-list">
        ${group.signals
          .slice(0, 12)
          .map((signal) => `<span class="signal">${escapeHtml(signal.label)}: ${escapeHtml(signal.value)}</span>`)
          .join("")}
      </div>
      <div class="group-rows">
        ${
          hiddenCount > 0
            ? `<p class="muted">Đang hiển thị 200 dòng đầu. Xuất CSV/JSON để lấy đủ ${group.members.length.toLocaleString("vi-VN")} dòng.</p>`
            : ""
        }
        <table>
          <thead>
            <tr>
              <th>Dòng</th>
              ${displayColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${visibleMembers
              .map(
                (row) => `
                  <tr>
                    <td>${row.__rowNumber}</td>
                    ${displayColumns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function updateMetrics() {
  const linkedRows = new Set();
  const activeRows = rowsForCurrentFilter();
  state.groups.forEach((group) => group.members.forEach((row) => linkedRows.add(row.__rowNumber)));
  els.rowCount.textContent = activeRows.length.toLocaleString("vi-VN");
  els.groupCount.textContent = state.groups.length.toLocaleString("vi-VN");
  els.linkedCount.textContent = linkedRows.size.toLocaleString("vi-VN");
  els.topScore.textContent =
    state.fileType === "wager_link"
      ? "-"
      : state.groups.length
        ? Math.max(...state.groups.map((group) => group.maxScore))
        : 0;
}

function exportCsv() {
  const extraHeaders = state.fileType === "wager_link" ? ["ho_ten_khong_space"] : [];
  const rows = [["group_id", "signals", "group_type", "recommendation", "risk_score", "row_number", ...state.headers, ...extraHeaders]];
  state.groups.forEach((group) => {
    const signals = group.signals.map((signal) => `${signal.label}: ${signal.value}`).join("; ");
    group.members.forEach((member) => {
      rows.push([
        group.id,
        signals,
        group.source || "Điểm trùng",
        group.recommendation || "",
        group.maxScore,
        member.__rowNumber,
        ...state.headers.map((header) => member[header]),
        ...extraHeaders.map((header) => member[header]),
      ]);
    });
  });
  download(`${baseExportName()}-groups.csv`, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
}

function exportColoredXls() {
  const extraHeaders = state.fileType === "wager_link" ? ["ho_ten_khong_space"] : [];
  const duplicateInfo = buildCrossGroupDuplicateInfo();
  const duplicateHeaders = ["trung_nhieu_nhom", "cac_nhom_da_xuat_hien"];
  const headers = [
    "group_id",
    "signals",
    "group_type",
    "recommendation",
    "risk_score",
    "row_number",
    ...duplicateHeaders,
    ...state.headers,
    ...extraHeaders,
  ];
  const colors = ["#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc", "#fce5cd", "#e2f0d9", "#ddebf7", "#f4cccc"];

  const headerHtml = headers
    .map((header) => `<th style="background:#1f4e78;color:#fff;border:1px solid #9aa6b2;padding:6px;text-align:left;">${escapeHtml(header)}</th>`)
    .join("");

  const bodyHtml = state.groups
    .map((group, groupIndex) => {
      const signals = group.signals.map((signal) => `${signal.label}: ${signal.value}`).join("; ");
      const color = colors[groupIndex % colors.length];
      return group.members
        .map((member) => {
          const accountKey = accountKeyForMember(member);
          const duplicateGroups = duplicateInfo.get(accountKey) || [];
          const isCrossGroupDuplicate = duplicateGroups.length > 1;
          const values = [
            group.id,
            signals,
            group.source || "Điểm trùng",
            group.recommendation || "",
            group.maxScore,
            member.__rowNumber,
            isCrossGroupDuplicate ? "YES" : "",
            isCrossGroupDuplicate ? duplicateGroups.join(", ") : "",
            ...state.headers.map((header) => member[header]),
            ...extraHeaders.map((header) => member[header]),
          ];
          const rowColor = isCrossGroupDuplicate ? "#ff9999" : color;
          return `<tr style="background:${rowColor};">${values
            .map((value) => `<td style="border:1px solid #c8d0d9;padding:5px;mso-number-format:'\\@';">${escapeHtml(value)}</td>`)
            .join("")}</tr>`;
        })
        .join("");
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </body>
</html>`;

  download(`${baseExportName()}-colored-groups.xls`, `\uFEFF${html}`, "application/vnd.ms-excel;charset=utf-8");
}

function buildCrossGroupDuplicateInfo() {
  const groupsByAccount = new Map();
  state.groups.forEach((group) => {
    group.members.forEach((member) => {
      const key = accountKeyForMember(member);
      if (!key) return;
      if (!groupsByAccount.has(key)) groupsByAccount.set(key, new Set());
      groupsByAccount.get(key).add(group.id);
    });
  });
  return new Map([...groupsByAccount.entries()].map(([key, ids]) => [key, [...ids].sort((a, b) => a - b)]));
}

function accountKeyForMember(member) {
  const accountColumn =
    state.headers.find((header) => normalizeHeader(header) === "tentaikhoan") ||
    state.headers.find((header) => state.mapping[header] === "username") ||
    state.headers.find((header) => state.mapping[header] === "account_id") ||
    state.headers[0];
  return String(member[accountColumn] || "").trim().toLowerCase();
}

function exportJson() {
  download(`${baseExportName()}-groups.json`, JSON.stringify(state.groups, null, 2), "application/json");
}

function baseExportName() {
  return (state.sourceName || "account-analysis").replace(/\.[^.]+$/, "");
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\r\n");
}

function download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showMessage(element, message) {
  element.classList.add("empty-state");
  element.innerHTML = escapeHtml(message);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

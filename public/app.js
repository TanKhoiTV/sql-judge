let db = null;
let SQL = null;
let exercises = [];
let currentId = null;
let currentMode = "practice";
let schemaData = null;
let cmEditor = null;
let cmSandbox = null;
let activeDbName = "Unilever Product Management";
let activeDbId = "unilever";
let allExerciseDefs = [];
function runQuery(sql) {
  try {
    const results = db.exec(sql);
    if (!results || results.length === 0)
      return { ok: true, cols: [], rows: [], rowCount: 0 };
    const cols = results[0].columns;
    const rows = results[0].values.map((v) => {
      const row = {};
      cols.forEach((c, i) => {
        row[c] = v[i];
      });
      return row;
    });
    return { ok: true, cols, rows, rowCount: rows.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
function getSchema() {
  const tables = {};
  const tableRows = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  if (!tableRows || tableRows.length === 0) return tables;
  const tableNames = tableRows[0].values.map((v) => v[0]);
  for (const t of tableNames) {
    const colResult = db.exec("PRAGMA table_info('" + t + "')");
    const cols = colResult[0].values.map((v) => ({
      name: v[1],
      type: v[2],
      pk: !!v[5],
      notnull: !!v[3],
      default: v[4]
    }));
    const fkResult = db.exec("PRAGMA foreign_key_list('" + t + "')");
    const fks = fkResult && fkResult.length ? fkResult[0].values.map((v) => ({
      from: v[3],
      table: v[2],
      to: v[4]
    })) : [];
    tables[t] = { columns: cols, foreignKeys: fks };
  }
  return tables;
}
function normalizeValue(v) {
  if (v === null || v === void 0) return "";
  if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
  return String(v).trim();
}
function compareResults(user, ref) {
  const issues = [];
  if (!user.ok) {
    return { pass: false, issues: ["Query failed: " + user.error] };
  }
  if (!ref.ok) {
    return {
      pass: false,
      issues: ["Reference query failed: " + ref.error]
    };
  }
  if (user.cols.length !== ref.cols.length) {
    issues.push(
      "Expected " + ref.cols.length + " column(s) [" + ref.cols.join(", ") + "], got " + user.cols.length + " [" + user.cols.join(", ") + "]"
    );
  }
  const userLower = user.cols.map((c) => c.toLowerCase());
  const refLower = ref.cols.map((c) => c.toLowerCase());
  for (let i = 0; i < Math.min(user.cols.length, ref.cols.length); i++) {
    if (userLower[i] !== refLower[i]) {
      issues.push(
        "Column " + (i + 1) + ': expected "' + ref.cols[i] + '", got "' + user.cols[i] + '"'
      );
    }
  }
  if (user.rowCount !== ref.rowCount) {
    issues.push(
      "Expected " + ref.rowCount + " row(s), got " + user.rowCount
    );
  }
  const colCount = Math.min(user.cols.length, ref.cols.length);
  const userSet = new Set(
    user.rows.map(
      (r) => user.cols.slice(0, colCount).map((c) => normalizeValue(r[c])).join("||")
    )
  );
  const refSet = new Set(
    ref.rows.map(
      (r) => ref.cols.slice(0, colCount).map((c) => normalizeValue(r[c])).join("||")
    )
  );
  const missing = [...refSet].filter((k) => !userSet.has(k));
  const extra = [...userSet].filter((k) => !refSet.has(k));
  if (missing.length > 0 || extra.length > 0) {
    issues.push(
      missing.length + " missing row(s), " + extra.length + " extra row(s)"
    );
  }
  return { pass: issues.length === 0, issues };
}
function showSidebar(panel) {
  document.querySelectorAll(".sidebar-tab").forEach(
    (t) => t.classList.toggle("active", t.dataset.panel === panel)
  );
  document.querySelectorAll(".sidebar-panel").forEach(
    (p) => p.classList.toggle("active", p.id === "panel-" + panel)
  );
}
function loadExercises() {
  if (activeDbId !== "unilever") {
    exercises = [];
    document.getElementById("exerciseList").innerHTML = `<div style="padding:20px;text-align:center;color:#8b949e;font-size:13px">\u{1F4ED} No exercises for this database.<br>Switch to <a href="#" onclick="switchMode('sandbox');return false" style="color:#58a6ff">Sandbox mode</a> to run your own queries.</div>`;
    return;
  }
  exercises = allExerciseDefs.map((e) => ({
    id: e.id,
    title: e.title,
    difficulty: e.difficulty
  }));
  document.getElementById("exerciseList").innerHTML = exercises.map(
    (e) => `<div class="exercise-item" data-id="${e.id}" onclick="selectExercise('${e.id}')">
      <div class="title">${e.title}</div>
      <div class="meta"><span class="diff-badge diff-${e.difficulty}">${e.difficulty}</span>${e.id}</div>
    </div>`
  ).join("");
}
function selectExercise(id) {
  currentId = id;
  document.querySelectorAll(".exercise-item").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  if (currentMode === "practice") loadPractice(id);
  else loadSandbox();
}
function switchMode(mode) {
  currentMode = mode;
  document.getElementById("tabPractice").classList.toggle("active", mode === "practice");
  document.getElementById("tabSandbox").classList.toggle("active", mode === "sandbox");
  if (mode === "sandbox") loadSandbox();
  else if (currentId) loadPractice(currentId);
  else {
    document.getElementById("mainContent").innerHTML = '<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>\u{1F448} Select an exercise</h3></div>';
  }
}
function createEditor(containerId, initialValue) {
  const textarea = document.createElement("textarea");
  textarea.value = initialValue || "";
  document.getElementById(containerId).appendChild(textarea);
  const editor = CodeMirror.fromTextArea(textarea, {
    mode: "text/x-sql",
    theme: "dracula",
    lineNumbers: true,
    indentWithTabs: true,
    smartIndent: true,
    lineWrapping: true,
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Ctrl-Enter": () => {
      },
      "Cmd-Enter": () => {
      }
    },
    hintOptions: {
      completeSingle: false,
      tables: {}
    }
  });
  editor.on("change", () => {
    editor.setSize(
      null,
      Math.max(120, editor.getScrollInfo().height + 10)
    );
  });
  editor.on("inputRead", (cm, change) => {
    if (change.text.length === 1 && /[a-zA-Z._]/.test(change.text[0])) {
      CodeMirror.commands.autocomplete(cm, null, {
        completeSingle: false
      });
    }
  });
  return editor;
}
function getEditorValue(editor) {
  return editor.getValue().trim();
}
function setEditorValue(editor, val) {
  editor.setValue(val || "");
  editor.setSize(null, Math.max(120, editor.getScrollInfo().height + 10));
  editor.focus();
}
function loadSchemaData() {
  if (schemaData) {
    refreshEditorHints();
    return;
  }
  schemaData = getSchema();
  refreshEditorHints();
}
function refreshEditorHints() {
  const tables = {};
  if (schemaData) {
    for (const [name, info] of Object.entries(schemaData)) {
      tables[name] = info.columns.map((c) => c.name);
    }
  }
  const hintCfg = { tables, completeSingle: false };
  if (cmEditor) cmEditor.setOption("hintOptions", hintCfg);
  if (cmSandbox) cmSandbox.setOption("hintOptions", hintCfg);
}
function renderTableCards() {
  if (!schemaData) return;
  const container = document.getElementById("sv-cards");
  let html = '<div class="table-cards">';
  const tableOrder = [
    "NHOM_HANG",
    "LOAI_NV",
    "HINH_THUC_DONG_GOI",
    "DOI",
    "DAI_LY",
    "NHAN_VIEN",
    "HANG_HOA",
    "PHIEU_XUAT",
    "CTPX",
    "HOA_DON",
    "CTHD"
  ];
  for (const t of tableOrder) {
    const info = schemaData[t];
    if (!info) continue;
    const pkNames = info.columns.filter((c) => c.pk).map((c) => c.name);
    const pkStr = pkNames.join(", ");
    html += `<div class="table-card">
      <div class="table-card-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        <span>${t} <span class="badge">(${info.columns.length})</span></span>
        <span style="font-size:10px;color:#8b949e">PK: ${pkStr}</span>
      </div>
      <div class="table-card-body">`;
    for (const c of info.columns) {
      html += `<div class="schema-col${c.pk ? " pk" : ""}">
        ${c.pk ? '<span class="col-pk">\u{1F511}</span>' : '<span style="color:#30363d">\xB7</span>'}
        <span class="col-name">${c.name}</span>
        <span class="col-type">${c.type.toLowerCase()}</span>
        ${c.notnull ? '<span style="color:#f0883e;font-size:9px">NOT NULL</span>' : ""}
        ${c.default ? '<span style="color:#8b949e;font-size:9px">DEFAULT ' + c.default + "</span>" : ""}
      </div>`;
    }
    for (const fk of info.foreignKeys) {
      html += `<div class="schema-fk">\u21B3 ${fk.from} \u2192 ${fk.table}(${fk.to})</div>`;
    }
    html += `</div></div>`;
  }
  html += "</div>";
  container.innerHTML = html;
}
function renderERDiagram() {
  if (!schemaData) return;
  const container = document.getElementById("mermaidContainer");
  let mmd = "erDiagram\n";
  for (const [name, info] of Object.entries(schemaData)) {
    mmd += `  ${name} {
`;
    for (const c of info.columns) {
      const cType = c.type.toLowerCase().replace(/\(.*/, "");
      const tags = [];
      if (c.pk) tags.push("PK");
      if (info.foreignKeys.some((f) => f.from === c.name))
        tags.push("FK");
      const tagStr = tags.length > 0 ? " " + tags.join(", ") : "";
      mmd += `    ${cType} ${c.name}${tagStr}
`;
    }
    mmd += "  }\n";
  }
  mmd += "\n";
  for (const [name, info] of Object.entries(schemaData)) {
    for (const fk of info.foreignKeys) {
      mmd += `  ${fk.table} ||--o{ ${name} : "${fk.from} \u2192 ${fk.table}.${fk.to}"
`;
    }
  }
  container.innerHTML = '<div class="mermaid" style="text-align:center">' + mmd.replace(/</g, "&lt;") + "</div>";
  const el = container.querySelector(".mermaid");
  if (el) {
    mermaid.run({ nodes: [el] }).catch((e) => {
      container.innerHTML = '<div style="color:#ff7b72;padding:20px;">ER diagram render error: ' + e.message + "</div>";
    });
  }
}
function showSchemaView(view) {
  document.querySelectorAll(".schema-tab").forEach(
    (t) => t.classList.toggle("active", t.dataset.stab === view)
  );
  document.querySelectorAll(".schema-view").forEach((s) => s.classList.toggle("active", s.id === "sv-" + view));
  if (view === "er" && schemaData) {
    setTimeout(() => renderERDiagram(), 100);
  }
}
function loadSchema() {
  if (!schemaData) {
    schemaData = getSchema();
    renderTableCards();
    refreshEditorHints();
  }
}
function loadPractice(id) {
  const ex = allExerciseDefs.find((e) => e.id === id);
  if (!ex) return;
  document.getElementById("mainTitle").textContent = ex.title;
  const content = document.getElementById("mainContent");
  content.innerHTML = `
    <div class="question">
      <h3>\u{1F4CB} Question</h3>
      <p>${ex.question}</p>
      <div class="tables">Tables: ${ex.tables.map((t) => "<span>" + t + "</span>").join("")}</div>
    </div>
    <div class="sql-section" id="editorContainer">
      <div class="sql-actions">
        <button class="btn btn-primary" id="runBtn" onclick="runJudge()">\u25B6 Run</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmEditor, '')">Clear</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmEditor, sessionStorage.getItem('lastQuery_${id}') || '')">Restore</button>
        <span class="status" id="status"></span>
      </div>
    </div>
    <div id="results"></div>`;
  if (cmEditor) {
    cmEditor.toTextArea();
    cmEditor = null;
  }
  const last = sessionStorage.getItem("lastQuery_" + id) || "";
  cmEditor = createEditor("editorContainer", last);
  const actions = content.querySelector(".sql-actions");
  content.querySelector("#editorContainer").insertBefore(
    content.querySelector("#editorContainer .CodeMirror"),
    actions
  );
  cmEditor.setOption("extraKeys", {
    "Ctrl-Space": "autocomplete",
    "Ctrl-Enter": () => runJudge(),
    "Cmd-Enter": () => runJudge()
  });
  if (schemaData) {
    cmEditor.setOption("hintOptions", {
      tables: buildTableHints(),
      completeSingle: false
    });
  }
  cmEditor.focus();
}
function loadSandbox() {
  document.getElementById("mainTitle").textContent = "\u{1F527} Sandbox \u2014 Free Query Mode";
  const content = document.getElementById("mainContent");
  content.innerHTML = `
    <div class="sandbox-note">Run any SQL query. No judging \u2014 just results.</div>
    <div class="sql-section" id="sandboxContainer">
      <div class="sql-actions">
        <button class="btn btn-primary" id="sandboxRunBtn" onclick="runSandbox()">\u25B6 Run</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmSandbox, '')">Clear</button>
        <span class="status" id="sandboxStatus"></span>
      </div>
    </div>
    <div id="sandboxResults"></div>`;
  if (cmSandbox) {
    cmSandbox.toTextArea();
    cmSandbox = null;
  }
  cmSandbox = createEditor(
    "sandboxContainer",
    "SELECT * FROM HANG_HOA LIMIT 5;"
  );
  const actions = content.querySelector(".sql-actions");
  content.querySelector("#sandboxContainer").insertBefore(
    content.querySelector("#sandboxContainer .CodeMirror"),
    actions
  );
  cmSandbox.setOption("extraKeys", {
    "Ctrl-Space": "autocomplete",
    "Ctrl-Enter": () => runSandbox(),
    "Cmd-Enter": () => runSandbox()
  });
  if (schemaData) {
    cmSandbox.setOption("hintOptions", {
      tables: buildTableHints(),
      completeSingle: false
    });
  }
  cmSandbox.focus();
}
function buildTableHints() {
  if (!schemaData) return {};
  const tables = {};
  for (const [name, info] of Object.entries(schemaData)) {
    tables[name] = info.columns.map((c) => c.name);
    tables[name.toLowerCase()] = info.columns.map((c) => c.name);
  }
  return tables;
}
function runJudge() {
  const query = getEditorValue(cmEditor);
  if (!query) return;
  sessionStorage.setItem("lastQuery_" + currentId, query);
  const ex = allExerciseDefs.find((e) => e.id === currentId);
  if (!ex) return;
  const btn = document.getElementById("runBtn");
  const status = document.getElementById("status");
  btn.disabled = true;
  status.textContent = "\u23F3 Running...";
  setTimeout(() => {
    const user = runQuery(query);
    const ref = runQuery(ex.solution);
    const result = compareResults(user, ref);
    renderJudgeResults({
      pass: result.pass,
      issues: result.issues,
      user: user.ok ? {
        cols: user.cols,
        rows: user.rows.slice(0, 50),
        rowCount: user.rowCount
      } : { error: user.error },
      ref: ref.ok ? {
        cols: ref.cols,
        rows: ref.rows.slice(0, 50),
        rowCount: ref.rowCount
      } : null,
      solution: ex.solution,
      hint: ex.hint || null
    });
    btn.disabled = false;
    status.textContent = "";
  }, 50);
}
function renderJudgeResults(data) {
  const el = document.getElementById("results");
  let html = '<div class="results">';
  if (data.pass) {
    html += `<div class="result-box"><div class="result-header pass">\u2705 PASS \u2014 Your query is correct!</div></div>`;
  } else {
    html += `<div class="result-box"><div class="result-header fail">\u274C FAIL \u2014 ${data.issues.length} issue(s)</div>`;
    html += `<div class="issues"><ul>${data.issues.map((i) => "<li>" + escHtml(i) + "</li>").join("")}</ul></div>`;
    if (data.hint)
      html += `<div class="hint">\u{1F4A1} ${escHtml(data.hint)}</div>`;
    html += `</div>`;
  }
  html += `<div class="solution">
    <div class="solution-header" onclick="this.nextElementSibling.classList.toggle('open')">
      \u{1F4D6} Reference solution ${data.pass ? "(yours matches)" : ""} \u25BE
    </div>
    <div class="solution-body">${escHtml(data.solution)}</div>
  </div>`;
  if (data.user && !data.user.error) {
    html += resultTable(
      "\u{1F4CA} Your result",
      data.user.cols,
      data.user.rows,
      data.user.rowCount
    );
  } else if (data.user && data.user.error) {
    html += `<div class="result-box"><div class="result-header fail">\u26A0\uFE0F ${escHtml(data.user.error)}</div></div>`;
  }
  if (data.ref) {
    html += resultTable(
      "\u{1F4D6} Expected result",
      data.ref.cols,
      data.ref.rows,
      data.ref.rowCount
    );
  }
  html += "</div>";
  el.innerHTML = html;
}
function runSandbox() {
  const query = getEditorValue(cmSandbox);
  if (!query) return;
  const btn = document.getElementById("sandboxRunBtn");
  const status = document.getElementById("sandboxStatus");
  btn.disabled = true;
  status.textContent = "\u23F3 Running...";
  setTimeout(() => {
    const result = runQuery(query);
    if (result.ok) {
      document.getElementById("sandboxResults").innerHTML = resultTable(
        "\u{1F4CA} " + result.rowCount + " row(s)",
        result.cols,
        result.rows,
        result.rowCount
      );
    } else {
      document.getElementById("sandboxResults").innerHTML = `<div class="result-box"><div class="result-header fail">\u26A0\uFE0F ${escHtml(result.error)}</div></div>`;
    }
    btn.disabled = false;
    status.textContent = "";
  }, 50);
}
function updateDbStatusUI() {
  document.getElementById("dbName").textContent = activeDbName;
  document.getElementById("dbBadge").className = "db-badge" + (activeDbId === "custom" ? " custom" : "");
  document.getElementById("resetBtn").style.display = activeDbId === "custom" ? "" : "none";
}
function showLoadSqlModal() {
  document.getElementById("sqlModal").classList.add("open");
  document.getElementById("sqlText").value = "";
  document.getElementById("sqlDbName").value = "";
  document.getElementById("sqlFileInput").value = "";
  document.getElementById("loadSqlError").textContent = "";
  document.getElementById("loadSqlStatus").textContent = "";
  document.getElementById("sqlText").focus();
  document.getElementById("sqlFileInput").onchange = function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("sqlText").value = e.target.result;
      document.getElementById("loadSqlStatus").textContent = "\u{1F4C4} Loaded " + file.name;
    };
    reader.readAsText(file);
  };
}
function closeLoadSqlModal() {
  document.getElementById("sqlModal").classList.remove("open");
}
function loadSqlFromText() {
  const sql = document.getElementById("sqlText").value.trim();
  if (!sql) {
    document.getElementById("loadSqlError").textContent = "Please paste SQL or upload a .sql file.";
    return;
  }
  const name = document.getElementById("sqlDbName").value.trim() || "Custom Database";
  const btn = document.querySelector("#sqlModal .btn-primary");
  const status = document.getElementById("loadSqlStatus");
  const errorEl = document.getElementById("loadSqlError");
  errorEl.textContent = "";
  btn.disabled = true;
  status.textContent = "\u23F3 Loading...";
  setTimeout(() => {
    try {
      const newDb = new SQL.Database();
      newDb.run("PRAGMA foreign_keys = ON");
      newDb.run(sql);
      db = newDb;
      activeDbName = name;
      activeDbId = "custom";
      closeLoadSqlModal();
      schemaData = null;
      cmEditor = null;
      cmSandbox = null;
      currentId = null;
      updateDbStatusUI();
      const content = document.getElementById("mainContent");
      content.innerHTML = '<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>\u2705 Database loaded: ' + escHtml(name) + '</h3><p style="margin-top:8px;font-size:13px;color:#8b949e">Use Sandbox mode to run queries.</p></div>';
      document.getElementById("mainTitle").textContent = name;
      document.querySelectorAll(".exercise-item").forEach((el) => el.classList.remove("active"));
      schemaData = getSchema();
      loadExercises();
      renderTableCards();
      refreshEditorHints();
    } catch (e) {
      errorEl.textContent = "SQL error: " + e.message;
    }
    btn.disabled = false;
    status.textContent = "";
  }, 50);
}
async function resetDatabase() {
  const res = await fetch("db/Unilever_Product_Management.db");
  const buffer = await res.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  activeDbName = "Unilever Product Management";
  activeDbId = "unilever";
  schemaData = null;
  cmEditor = null;
  cmSandbox = null;
  currentId = null;
  updateDbStatusUI();
  document.getElementById("mainTitle").textContent = "Unilever Product Management";
  document.getElementById("mainContent").innerHTML = '<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>\u{1F448} Select an exercise from the sidebar</h3></div>';
  document.querySelectorAll(".exercise-item").forEach((el) => el.classList.remove("active"));
  schemaData = getSchema();
  loadExercises();
  renderTableCards();
  refreshEditorHints();
}
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function resultTable(label, cols, rows, rowCount) {
  let html = '<div class="result-box"><div class="result-header">' + label + " \u2014 " + rowCount + ' row(s)</div><div class="result-body"><table><thead><tr>';
  for (const c of cols) html += "<th>" + escHtml(c) + "</th>";
  html += "</tr></thead><tbody>";
  for (const r of rows) {
    html += "<tr>";
    for (const c of cols)
      html += "<td>" + (r[c] === null ? '<span style="color:#8b949e">NULL</span>' : escHtml(String(r[c]))) + "</td>";
    html += "</tr>";
  }
  html += "</tbody></table></div></div>";
  return html;
}
mermaid.initialize({ theme: "dark", startOnLoad: false });
async function init() {
  try {
    const vRes = await fetch("VERSION");
    const vText = await vRes.text();
    document.getElementById("versionBadge").textContent = "v" + vText.trim();
  } catch {
  }
  try {
    const exRes = await fetch("exercises/exercises.json");
    allExerciseDefs = await exRes.json();
  } catch {
  }
  try {
    SQL = await initSqlJs({
      locateFile: (file) => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/" + file
    });
  } catch (e) {
    document.getElementById("mainContent").innerHTML = '<div class="question" style="text-align:center;color:#ff7b72;padding:60px 20px;"><h3>\u274C Failed to load SQL engine: ' + escHtml(e.message) + "</h3></div>";
    return;
  }
  try {
    const dbRes = await fetch("db/Unilever_Product_Management.db");
    const dbBuffer = await dbRes.arrayBuffer();
    db = new SQL.Database(new Uint8Array(dbBuffer));
  } catch (e) {
    document.getElementById("mainContent").innerHTML = '<div class="question" style="text-align:center;color:#ff7b72;padding:60px 20px;"><h3>\u274C Failed to load database: ' + escHtml(e.message) + "</h3></div>";
    return;
  }
  updateDbStatusUI();
  schemaData = getSchema();
  renderTableCards();
  loadExercises();
  refreshEditorHints();
}
init().catch((e) => {
  console.error(e);
});

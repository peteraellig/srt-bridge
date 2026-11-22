"use strict";
// Stream IDs, names and addresses come from outside: they are only ever put
// into the page as text (textContent), never as HTML.

const $ = (id) => document.getElementById(id);
let state = null;
let settingsLoaded = false;
const drawn = {}; // what each part showed last, so it is rebuilt only when it changed

let tiles = [];

const I18N = {
  es: {
    brand_sub: "Estudio de Enlaces",
    nav_op: "OPERACIÓN",
    nav_sys: "SISTEMA",
    nav_main: "Canales",
    nav_matrix: "Matriz",
    nav_outputs: "Salidas Locales",
    nav_receivers: "Receptores",
    nav_setup: "Ajustes y Red",
    nav_keys: "Claves",
    nav_log: "Registro",
    nav_help: "Guía Rápida",
    nav_logout: "Cerrar sesión",
    lbl_ports: "Puertos SRT",
    lbl_port: "Puerto SRT",
    lbl_live: "En vivo",
    lbl_recv: "Receptores",
    lbl_in: "Entrada",
    lbl_out: "Salida",
    lbl_proto: "Protocolo",
    lbl_cpu: "CPU PC",
    lbl_cpu_proc: "CPU Bridge",
    lbl_ram: "RAM PC",
    lbl_ram_proc: "RAM Bridge",
    quick_title: "Panel de Canales",
    quick_sub: "Activa canales en 1 clic, copia el enlace para tu cámara u OBS y comparte el enlace de estudio.",
    quick_addr: "Red para enlaces",
    btn_add_channel: "+ Activar canal",
    btn_activate_all: "Activar todos",
    avail_channel: "Canal disponible",
    copy_cam: "Copiar Cámara",
    copy_stu: "Copiar Estudio",
    qr: "QR",
    stu_recv: "Estudio recibe:",
    btn_links: "Enlaces",
    btn_edit: "Editar",
    btn_clear: "Liberar",
    btn_cut: "Cortar",
    channel: "Canal",
    lamp_live: "EN VIVO",
    lamp_waiting: "ESPERANDO",
    lamp_free: "LIBRE",
    health_optimal: "Señal óptima",
    health_unstable: "Inestable",
    health_drop: "Pérdida",
    waiting_conn: "Esperando conexión…",
    recvs_connected_1: " receptor",
    recvs_connected_n: " receptores",
    recvs_waiting_1: " receptor conectado esperando señal",
    recvs_waiting_n: " receptores conectados esperando señal",
    hint_copy_cam: "Copia el enlace de Cámara y pégalo en OBS, vMix o escanea el QR",
    on_air: "Al aire",
    unassigned: "— Sin asignar —",
    net_lan: "Red Local (Wi-Fi / LAN)",
    net_wan: "Internet (IP Pública)",
    qr_title: "Código QR",
    qr_tab_text: "Cámara Celular (Texto)",
    qr_tab_larix: "Larix App",
    qr_tab_haivision: "Haivision Web",
    qr_tab_raw: "SRT Puro",
    qr_role_cam: "Rol: Enviar Cámara al Bridge",
    qr_role_stu: "Rol: Recibir Retorno de Estudio",
    qr_hint: "Escanea con la cámara de tu celular para copiar los datos, o elige Larix / Haivision según tu app.",
    btn_close: "Cerrar",
    btn_save: "Guardar",
    btn_cancel: "Cancelar",
    btn_generate: "Generar",
    edit_title: "Editar canal",
    link_title: "Todos los enlaces",
    link_addr_lbl: "Dirección de esta PC",
    no_answer: "Sin respuesta de SRT Bridge"
  },
  en: {
    brand_sub: "Live Link Hub",
    nav_op: "OPERATION",
    nav_sys: "SYSTEM",
    nav_main: "Channels",
    nav_matrix: "Matrix",
    nav_outputs: "Local Outputs",
    nav_receivers: "Receivers",
    nav_setup: "Setup & Network",
    nav_keys: "Keys",
    nav_log: "Log",
    nav_help: "Quick Guide",
    nav_logout: "Log out",
    lbl_ports: "SRT Ports",
    lbl_port: "SRT Port",
    lbl_live: "Live",
    lbl_recv: "Receivers",
    lbl_in: "In",
    lbl_out: "Out",
    lbl_proto: "Protocol",
    lbl_cpu: "PC CPU",
    lbl_cpu_proc: "Bridge CPU",
    lbl_ram: "PC RAM",
    lbl_ram_proc: "Bridge RAM",
    quick_title: "Channel Board",
    quick_sub: "Activate channels in 1 click, copy links for your camera or OBS, and share studio feed.",
    quick_addr: "Network IP",
    btn_add_channel: "+ Activate channel",
    btn_activate_all: "Activate all",
    avail_channel: "Available channel",
    copy_cam: "Copy Camera",
    copy_stu: "Copy Studio",
    qr: "QR",
    stu_recv: "Studio receives:",
    btn_links: "Links",
    btn_edit: "Edit",
    btn_clear: "Release",
    btn_cut: "Cut",
    channel: "Channel",
    lamp_live: "LIVE",
    lamp_waiting: "WAITING",
    lamp_free: "FREE",
    health_optimal: "Optimal signal",
    health_unstable: "Unstable",
    health_drop: "Packet drops",
    waiting_conn: "Waiting for connection…",
    recvs_connected_1: " receiver",
    recvs_connected_n: " receivers",
    recvs_waiting_1: " receiver connected waiting for signal",
    recvs_waiting_n: " receivers connected waiting for signal",
    hint_copy_cam: "Copy Camera link to OBS, vMix, or scan QR with phone",
    on_air: "On air",
    unassigned: "— Unassigned —",
    net_lan: "Local Network (Wi-Fi / LAN)",
    net_wan: "Internet (Public IP)",
    qr_title: "QR Code",
    qr_tab_text: "Phone Camera (Text)",
    qr_tab_larix: "Larix App",
    qr_tab_haivision: "Haivision Web",
    qr_tab_raw: "Raw SRT",
    qr_role_cam: "Role: Send Camera to Bridge",
    qr_role_stu: "Role: Receive Studio Return",
    qr_hint: "Scan with phone camera to copy details, or choose Larix / Haivision for your app.",
    btn_close: "Close",
    btn_save: "Save",
    btn_cancel: "Cancel",
    btn_generate: "Generate",
    edit_title: "Edit channel",
    link_title: "All links",
    link_addr_lbl: "This PC address",
    no_answer: "No answer from SRT Bridge"
  }
};

let currentLang = "es";
try { currentLang = localStorage.getItem("srt_lang") || "es"; } catch {}

function tr(key, fallback) {
  return (I18N[currentLang] && I18N[currentLang][key]) || fallback || key;
}

function updateLangSwitchUI() {
  const enBtn = $("langEn");
  const esBtn = $("langEs");
  if (enBtn) {
    enBtn.style.background = currentLang === "en" ? "#2158c7" : "transparent";
    enBtn.style.color = currentLang === "en" ? "#fff" : "#8fa0bf";
  }
  if (esBtn) {
    esBtn.style.background = currentLang === "es" ? "#2158c7" : "transparent";
    esBtn.style.color = currentLang === "es" ? "#fff" : "#8fa0bf";
  }
}

function applyLanguageToDOM() {
  updateLangSwitchUI();
  if ($("brandSub")) $("brandSub").textContent = tr("brand_sub", "Estudio de Enlaces");
  if ($("navGroupOp")) $("navGroupOp").textContent = tr("nav_op", "OPERACIÓN");
  if ($("navGroupSys")) $("navGroupSys").textContent = tr("nav_sys", "SISTEMA");
  if ($("navMain")) $("navMain").textContent = tr("nav_main", "Canales");
  if ($("navMatrix")) $("navMatrix").textContent = tr("nav_matrix", "Matriz");
  if ($("navOutputs")) $("navOutputs").textContent = tr("nav_outputs", "Salidas Locales");
  if ($("navReceivers")) $("navReceivers").textContent = tr("nav_receivers", "Receptores");
  if ($("navSetup")) $("navSetup").textContent = tr("nav_setup", "Ajustes y Red");
  if ($("navKeys")) $("navKeys").textContent = tr("nav_keys", "Claves");
  if ($("navLog")) $("navLog").textContent = tr("nav_log", "Registro");
  if ($("navHelp")) $("navHelp").textContent = tr("nav_help", "Guía Rápida");
  if ($("logoutBtn")) $("logoutBtn").textContent = tr("nav_logout", "Cerrar sesión");

  if ($("sidePortLbl")) $("sidePortLbl").textContent = tr("lbl_port", "Puerto SRT");
  if ($("sideLiveLbl")) $("sideLiveLbl").textContent = tr("lbl_live", "En vivo");
  if ($("sideRecvLbl")) $("sideRecvLbl").textContent = tr("lbl_recv", "Receptores");
  if ($("sideInLbl")) $("sideInLbl").textContent = tr("lbl_in", "Entrada");
  if ($("sideRateLbl")) $("sideRateLbl").textContent = tr("lbl_out", "Salida");
  if ($("sideSrtLbl")) $("sideSrtLbl").textContent = tr("lbl_proto", "Protocolo");
  if ($("sideCpuLbl")) $("sideCpuLbl").textContent = tr("lbl_cpu", "CPU PC");
  if ($("sideCpuProcLbl")) $("sideCpuProcLbl").textContent = tr("lbl_cpu_proc", "CPU Bridge");
  if ($("sideRamLbl")) $("sideRamLbl").textContent = tr("lbl_ram", "RAM PC");
  if ($("sideRamProcLbl")) $("sideRamProcLbl").textContent = tr("lbl_ram_proc", "RAM Bridge");

  if ($("quickBarTitle")) $("quickBarTitle").textContent = tr("quick_title", "Panel de Canales");
  if ($("quickBarSubtitle")) $("quickBarSubtitle").textContent = tr("quick_sub", "Activa canales en 1 clic...");
  if ($("quickAddrLbl")) $("quickAddrLbl").textContent = tr("quick_addr", "Red para enlaces");
  if ($("quickAddBtn")) $("quickAddBtn").textContent = tr("btn_add_channel", "+ Activar canal");
  if ($("quickAllBtn")) $("quickAllBtn").textContent = tr("btn_activate_all", "Activar todos");

  if ($("linkTitle")) $("linkTitle").textContent = tr("link_title", "Todos los enlaces");
  if ($("linkCloseBtn")) $("linkCloseBtn").textContent = tr("btn_close", "Cerrar");
  if ($("linkAddrLbl")) $("linkAddrLbl").childNodes[0].nodeValue = tr("link_addr_lbl", "Dirección de esta PC") + "\n    ";

  if ($("qrTitle")) $("qrTitle").textContent = tr("qr_title", "Código QR");
  if ($("qrCloseBtn")) $("qrCloseBtn").textContent = tr("btn_close", "Cerrar");
  if ($("qrModeText")) $("qrModeText").textContent = tr("qr_tab_text", "Cámara Celular (Texto)");
  if ($("qrModeLarix")) $("qrModeLarix").textContent = tr("qr_tab_larix", "Larix App");
  if ($("qrModeHaivision")) $("qrModeHaivision").textContent = tr("qr_tab_haivision", "Haivision Web");
  if ($("qrModeRaw")) $("qrModeRaw").textContent = tr("qr_tab_raw", "SRT Puro");
  if ($("qrRoleCamOpt")) $("qrRoleCamOpt").textContent = tr("qr_role_cam", "Rol: Enviar Cámara al Bridge");
  if ($("qrRoleStuOpt")) $("qrRoleStuOpt").textContent = tr("qr_role_stu", "Rol: Recibir Retorno de Estudio");
  if ($("qrHint")) $("qrHint").textContent = tr("qr_hint", "Escanea con la cámara de tu celular...");

  if ($("editTitle")) $("editTitle").textContent = tr("edit_title", "Editar canal");
  if ($("editCancelBtn")) $("editCancelBtn").textContent = tr("btn_cancel", "Cancelar");
  if ($("editSaveBtn")) $("editSaveBtn").textContent = tr("btn_save", "Guardar");
  if ($("editGen")) $("editGen").textContent = tr("btn_generate", "Generar");
  if ($("editRecvGen")) $("editRecvGen").textContent = tr("btn_generate", "Generar");

  if (Array.isArray(tiles)) {
    for (const t of tiles) {
      if (t.activateBtn) t.activateBtn.textContent = tr("btn_add_channel", "+ Activar canal");
      if (t.freeBody) {
        const p = t.freeBody.querySelector("p");
        if (p) p.textContent = tr("avail_channel", "Canal disponible");
      }
      if (t.copyCam) t.copyCam.textContent = tr("copy_cam", "Copiar Cámara");
      if (t.copyStu) t.copyStu.textContent = tr("copy_stu", "Copiar Estudio");
      if (t.qrBtn) t.qrBtn.textContent = tr("qr", "QR");
      if (t.routeRow) {
        const sp = t.routeRow.querySelector("span");
        if (sp) sp.textContent = tr("stu_recv", "Estudio recibe:");
      }
      if (t.links) t.links.textContent = tr("btn_links", "Enlaces");
      if (t.edit) t.edit.textContent = tr("btn_edit", "Editar");
      if (t.clearBtn) t.clearBtn.textContent = tr("btn_clear", "Liberar");
      if (t.disc) t.disc.textContent = tr("btn_cut", "Cortar");
    }
  }
}

function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "es";
  try { localStorage.setItem("srt_lang", currentLang); } catch {}
  applyLanguageToDOM();
  if (state) render(state);
}

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

// Text is only written when it differs, so nothing flickers once a second.
function put(node, text, cls) {
  if (node.textContent !== text) node.textContent = text;
  if (cls !== undefined && node.className !== cls) node.className = cls;
}

// A note for two seconds in a place that is always there: it never moves the layout.
const noteTimers = {};
function note(id, text) {
  const n = $(id);
  n.textContent = text;
  clearTimeout(noteTimers[id]);
  if (text) noteTimers[id] = setTimeout(() => { n.textContent = ""; }, id.endsWith("Err") ? 6000 : 2000);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "unexpected answer" }));
  if (res.status === 401 && data.login) showLogin();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ---- login, only over remote access (HTTPS); the bridge PC itself needs none ----
let loginOpen = false;
function showLogin() {
  if (loginOpen) return;
  loginOpen = true;
  for (const d of document.querySelectorAll("dialog[open]")) d.close();
  $("loginErr").textContent = "";
  $("loginPass").value = "";
  $("loginDlg").showModal();
  $("loginPass").focus();
}
// Escape must not close it: behind it there is nothing to see.
$("loginDlg").addEventListener("cancel", (ev) => ev.preventDefault());
$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("loginPass").value }) });
    const data = await res.json().catch(() => ({ error: "unexpected answer" }));
    if (!res.ok) throw new Error(data.error || res.statusText);
    loginOpen = false;
    $("loginDlg").close();
    settingsLoaded = false;
  } catch (e) {
    $("loginErr").textContent = e.message;
    $("loginPass").select();
  }
});
$("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
});

async function change(method, path, body, okNote, errNote) {
  try {
    render(await api(method, path, body));
    if (okNote) note(okNote[0], okNote[1]);
    return true;
  } catch (e) {
    if (okNote) note(okNote[0], "");
    note(errNote, e.message);
    return false;
  }
}

const label = (p) => p.name || "Line " + p.slot;
// The stream ID receivers use for the forward output: the receiver key, or sender key*forward.
const recvName = (p) => p.recvId || p.id + "*" + state.suffixes[0];
// One port per signal: the port says which signal, stream IDs are not used.
const perSignal = () => state.portMode === "signal";
const inUse = (p) => perSignal() || !!p.id;
const range = (r) => String(r).replace("-", "–");
const kbps = (v) => Math.round(v * 1024) + " kbit/s";
const mbps = (v) => (v >= 10 ? v.toFixed(1) : v.toFixed(2)) + " Mbit/s";
const count = (n, one, many) => n + " " + (n === 1 ? one : many);
function pct(part, all) {
  if (!all) return "0 %";
  const v = part / all * 100;
  return (v === 0 ? "0" : v < 0.1 ? "<0.1" : v.toFixed(1)) + " %";
}
function since(t) {
  let s = Math.max(0, Math.floor(Date.now() / 1000) - t);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const p = (n) => String(n).padStart(2, "0");
  return h + ":" + p(m) + ":" + p(s);
}
const clock = (t) => new Date(t * 1000).toLocaleTimeString("de-CH");

function changed(key, value) {
  const s = JSON.stringify(value);
  if (drawn[key] === s) return false;
  drawn[key] = s;
  return true;
}

async function copy(text, btn) {
  const was = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copiado";
    btn.classList.add("copied");
  } catch {
    btn.textContent = "Error";
  }
  setTimeout(() => { btn.textContent = was; btn.classList.remove("copied"); }, 1400);
}

function sortedLocalAddrs() {
  const raw = (state && state.addresses && state.addresses.length) ? [...state.addresses] : ["127.0.0.1"];
  const rank = (ip) => ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 3 : 2;
  return raw.sort((a, b) => rank(a) - rank(b));
}

function quickHost() {
  const sel = $("quickAddr");
  if (sel && sel.value) return sel.value;
  const local = sortedLocalAddrs();
  return local[0] || state.publicIp || "127.0.0.1";
}

function buildSrtUrlForHost(p, isForward, hostIp) {
  const host = (hostIp || quickHost()) + ":" + p.port;
  if (perSignal()) {
    return "srt://" + host + "?latency=" + state.latencyMs + (p.passIn ? "&passphrase=" + encodeURIComponent(p.passIn) : "");
  }
  const sid = isForward ? recvName(p) : p.id;
  const pass = isForward ? p.passFwd : p.passIn;
  return "srt://" + host + "?streamid=" + encodeURIComponent(sid) + "&latency=" + state.latencyMs + (pass ? "&passphrase=" + encodeURIComponent(pass) : "");
}

function buildSrtUrl(p, isForward) {
  return buildSrtUrlForHost(p, isForward, quickHost());
}

function renderQuickBar() {
  const sel = $("quickAddr");
  if (!sel) return;
  const local = sortedLocalAddrs();
  const key = JSON.stringify([local, state.publicIp, currentLang]);
  if (drawn.quickAddr !== key) {
    drawn.quickAddr = key;
    const prev = sel.value;
    const opts = [];
    for (const a of local) opts.push(el("option", { value: a }, a + " · " + tr("net_lan", "Red Local (Wi-Fi / LAN)")));
    if (state.publicIp) opts.push(el("option", { value: state.publicIp }, state.publicIp + " · " + tr("net_wan", "Internet (IP Pública)")));
    sel.replaceChildren(...opts);
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }
  const hasFree = !perSignal() && state.places.some((p) => !inUse(p));
  const addBtn = $("quickAddBtn");
  if (addBtn) {
    addBtn.hidden = perSignal();
    addBtn.disabled = !hasFree;
  }
  const allBtn = $("quickAllBtn");
  if (allBtn) {
    allBtn.hidden = perSignal();
    allBtn.disabled = !hasFree;
  }
}

function nextFreeId(slot) {
  const taken = new Set();
  for (const p of state.places) {
    if (p.id) taken.add(p.id);
    if (p.recvId) taken.add(p.recvId);
  }
  const base = "cam" + slot;
  if (!taken.has(base)) return base;
  for (let n = 1; n <= 99; n++) {
    const cand = base + "_" + n;
    if (!taken.has(cand)) return cand;
  }
  return base + "_" + Date.now();
}

async function quickActivate(slot) {
  const p = state.places[slot - 1];
  const name = (p && p.name) ? p.name : "Cámara " + slot;
  const id = nextFreeId(slot);
  const source = (p && p.source) ? p.source : slot;
  try {
    render(await api("PUT", "/api/places", { slot, name, id, source }));
    note("mainNote", "Canal #" + slot + " activado (ID: " + id + ")");
  } catch (e) {
    note("mainErr", e.message);
  }
}

async function quickActivateAll() {
  if (!state || perSignal()) return;
  const freeList = state.places.filter((p) => !inUse(p));
  for (const p of freeList) {
    const slot = p.slot;
    const name = p.name || ("Cámara " + slot);
    const id = nextFreeId(slot);
    const source = p.source || slot;
    try {
      state = await api("PUT", "/api/places", { slot, name, id, source });
    } catch (e) {
      note("mainErr", e.message);
      render(state);
      return;
    }
  }
  render(state);
  note("mainNote", "Todos los canales están activos y listos");
}

async function quickClear(slot) {
  const p = state.places[slot - 1];
  if (!p || perSignal()) return;
  const n = (p.sender ? 1 : 0) + p.receivers.length + p.forward.length;
  if (n && !confirm("Hay " + n + " conexión(es) activa(s) en el canal #" + slot + ". ¿Liberar canal y desconectar?")) return;
  try {
    render(await api("PUT", "/api/places", { slot, id: "", name: "", passIn: "", passFwd: "", recvId: "" }));
    note("mainNote", "Canal #" + slot + " liberado");
  } catch (e) {
    note("mainErr", e.message);
  }
}

if ($("quickAddBtn")) {
  $("quickAddBtn").addEventListener("click", () => {
    if (!state) return;
    const free = state.places.find((p) => !inUse(p));
    if (free) quickActivate(free.slot);
  });
}
if ($("quickAllBtn")) {
  $("quickAllBtn").addEventListener("click", quickActivateAll);
}

function render(st) {
  state = st;
  renderSide();
  renderQuickBar();
  renderTiles();
  renderMatrix();
  renderReceivers();
  renderRejected();
  renderEvents();
  renderNet();
  renderRemote();
  renderAutostart();
  renderOutputs();
  renderKeys();
  put($("logWhere"), "· más recientes primero · log " + state.logFile);
  if (!settingsLoaded) { fillSettings(); settingsLoaded = true; }
}

function renderSide() {
  const used = state.places.filter(inUse).length;
  const live = state.places.filter((p) => p.sender).length;
  let recv = 0, out = 0, inp = 0;
  for (const p of state.places) {
    if (p.sender) inp += p.sender.mbps;
    for (const c of p.receivers.concat(p.forward)) { recv++; out += c.mbps; }
  }
  put($("sidePortLbl"), perSignal() ? tr("lbl_ports", "Puertos SRT") : tr("lbl_port", "Puerto SRT"));
  put($("sidePort"), range(state.portRange));
  $("sidePort").title = "UDP " + range(state.portRange);
  put($("sideSrt"), "SRT " + state.srtVersion);
  const sys = state.sys;
  put($("sideCpu"), sys.cpu.toFixed(0) + " %");
  put($("sideCpuProc"), sys.procCpu.toFixed(1) + " %");
  put($("sideRam"), sys.ramPct + " % " + (currentLang === "en" ? "of " : "de ") + sys.ramGb.toFixed(0) + " GB");
  put($("sideRamProc"), sys.procMb.toFixed(0) + " MB");
  put($("sideLive"), live + (currentLang === "en" ? " of " : " de ") + used);
  put($("sideRecv"), String(recv));
  put($("sideIn"), mbps(inp));
  put($("sideRate"), mbps(out));
  put($("credit"), "v" + state.version);
  if (state.srtError) put($("portBadge"), (currentLang === "en" ? "Port closed: " : "Puerto cerrado: ") + state.srtError, "chBadge bad");
  else put($("portBadge"), (currentLang === "en" ? "Active · UDP " : "Activo · UDP ") + range(state.portRange), "chBadge ok");
}

function buildTile(slot) {
  const t = { slot };
  t.name = el("span", { class: "name" });
  t.lamp = el("span", { class: "lamp" }, el("i"));
  t.lampText = el("span");
  t.lamp.append(t.lampText);

  t.activateBtn = el("button", { type: "button", class: "activateBtn", onclick: () => quickActivate(slot) }, tr("btn_add_channel", "+ Activar canal"));
  t.freeBody = el("div", { class: "freeBody" },
    el("p", null, tr("avail_channel", "Canal disponible")),
    t.activateBtn
  );

  t.heroRate = el("span", { class: "heroRate" }, "–");
  t.health = el("span", { class: "healthPill" });
  t.heroSub = el("div", { class: "heroSub" });
  t.heroErr = el("div", { class: "heroErr", hidden: true });

  t.copyCam = el("button", { type: "button", class: "qBtn cam", title: "Copia enlace SRT listo para pegar en Cámara / OBS / vMix", onclick: () => copy(buildSrtUrl(state.places[slot - 1], false), t.copyCam) }, tr("copy_cam", "Copiar Cámara"));
  t.copyStu = el("button", { type: "button", class: "qBtn", title: "Copia enlace SRT de retorno para VLC / Estudio", onclick: () => copy(buildSrtUrl(state.places[slot - 1], true), t.copyStu) }, tr("copy_stu", "Copiar Estudio"));
  t.qrBtn = el("button", { type: "button", class: "qBtn", title: "Mostrar código QR para celular (compatible con cámara normal, Larix y Haivision)", onclick: () => openSlotQr(slot) }, tr("qr", "QR"));

  t.routeSel = el("select", {
    title: "Elige qué señal de entrada sale en el enlace de Estudio de este canal",
    onchange: () => change("PUT", "/api/places", { slot, source: Number(t.routeSel.value) }, ["mainNote", "Ruta de canal #" + slot + " actualizada"], "mainErr")
  });
  t.routeRow = el("div", { class: "routeRow" }, el("span", null, tr("stu_recv", "Estudio recibe:")), t.routeSel);

  t.sid = el("span", { class: "tileKey" });
  t.links = el("button", { type: "button", class: "sm mini", title: "Ver todos los enlaces y opciones", onclick: () => openLinks(slot) }, tr("btn_links", "Enlaces"));
  t.edit = el("button", { type: "button", class: "sm mini", title: "Cambiar nombre, clave o contraseña", onclick: () => openEdit(slot) }, tr("btn_edit", "Editar"));
  t.clearBtn = el("button", { type: "button", class: "sm mini", title: "Liberar y desactivar este canal", onclick: () => quickClear(slot) }, tr("btn_clear", "Liberar"));
  t.disc = el("button", { type: "button", class: "sm mini", title: "Desconectar cámara actual", onclick: () => disconnect(slot) }, tr("btn_cut", "Cortar"));

  t.activeBody = el("div", { class: "activeBody", style: "display:flex;flex-direction:column;gap:10px" },
    el("div", { class: "heroMetrics" },
      el("div", { class: "heroTop" }, t.heroRate, t.health),
      t.heroSub,
      t.heroErr
    ),
    el("div", { class: "quickCopyRow" }, t.copyCam, t.copyStu, t.qrBtn),
    t.routeRow,
    el("div", { class: "tileFoot" }, t.sid, el("div", { class: "tileActs" }, t.links, t.edit, t.clearBtn, t.disc))
  );

  t.root = el("div", { class: "tile" },
    el("div", { class: "tileHead" }, el("span", { class: "no" }, "#" + slot), t.name, t.lamp),
    t.freeBody,
    t.activeBody
  );
  return t;
}

function renderTiles() {
  if (tiles.length !== state.places.length) {
    tiles = state.places.map((p) => buildTile(p.slot));
    $("tiles").replaceChildren(...tiles.map((t) => t.root));
  }
  const routeOptsKey = JSON.stringify(state.places.map((x) => [x.slot, label(x), !!x.sender]));
  for (const p of state.places) {
    const t = tiles[p.slot - 1], s = p.sender;
    const ps = perSignal(), used = inUse(p);
    t.root.className = "tile" + (s ? " live" : used ? "" : " free");
    put(t.name, used ? label(p) : tr("channel", "Canal") + " " + p.slot);
    t.name.title = label(p);
    put(t.lampText, s ? tr("lamp_live", "EN VIVO") : used ? tr("lamp_waiting", "ESPERANDO") : tr("lamp_free", "LIBRE"));
    t.lamp.className = "lamp" + (s ? " live" : used ? " wait" : "");

    t.freeBody.hidden = used;
    t.activeBody.hidden = !used;
    if (!used) continue;

    put(t.sid, ps ? "UDP " + p.port : "UDP " + p.port + " · ID: " + p.id);
    t.sid.title = ps ? "Puerto dedicado UDP " + p.port : "Puerto UDP " + p.port + " · Stream ID: " + p.id + " · Retorno: " + recvName(p);
    t.clearBtn.hidden = ps;
    t.disc.disabled = !s;

    if (s) {
      put(t.heroRate, kbps(s.mbps), "heroRate");
      const m = s.media;
      const vid = m ? [m.video, m.videoCodec].filter(Boolean).join(" ") : "";
      const aud = m && m.audio.length ? audioText(m) : "";
      const recvCount = p.receivers.length + p.forward.length;

      if (s.recentDrops > 0) {
        put(t.health, tr("health_drop", "Pérdida") + " (" + s.recentDrops + ")", "healthPill bad");
      } else if (s.recentLoss > 5) {
        put(t.health, tr("health_unstable", "Inestable"), "healthPill warn");
      } else {
        put(t.health, tr("health_optimal", "Señal óptima"), "healthPill good");
      }
      t.health.hidden = false;

      const parts = [];
      if (vid) parts.push(vid);
      if (aud) parts.push(aud);
      parts.push("RTT " + s.rttMs.toFixed(0) + "ms");
      parts.push(tr("on_air", "Al aire") + " " + since(s.since));
      if (recvCount) parts.push(recvCount + (recvCount === 1 ? tr("recvs_connected_1", " receptor") : tr("recvs_connected_n", " receptores")));
      put(t.heroSub, parts.join(" · "));
    } else {
      put(t.heroRate, tr("waiting_conn", "Esperando conexión…"), "heroRate muted");
      t.health.hidden = true;
      const recvCount = p.receivers.length + p.forward.length;
      put(t.heroSub, recvCount
        ? recvCount + (recvCount === 1 ? tr("recvs_waiting_1", " receptor conectado esperando señal") : tr("recvs_waiting_n", " receptores conectados esperando señal"))
        : tr("hint_copy_cam", "Copia el enlace de Cámara y pégalo en OBS, vMix o escanea el QR"));
    }

    const e = signalError(p.slot);
    t.heroErr.hidden = !e;
    if (e) {
      put(t.heroErr, "Error: " + e.short);
      t.heroErr.title = e.reason + " (" + e.addr + ")";
    }

    if (t.routeKey !== routeOptsKey) {
      t.routeKey = routeOptsKey;
      const opts = [el("option", { value: "0" }, tr("unassigned", "— Sin asignar —"))];
      for (const x of state.places) {
        opts.push(el("option", { value: String(x.slot) }, (x.sender ? (currentLang === "en" ? "[LIVE] " : "[VIVO] ") : "") + "#" + x.slot + " " + label(x)));
      }
      t.routeSel.replaceChildren(...opts);
    }
    if (document.activeElement !== t.routeSel) {
      t.routeSel.value = String(p.source || 0);
    }
  }
}

// "8 ch · 4 tracks AAC": what arrives, all tracks together.
function audioText(m) {
  if (!m.audio.length) return "none";
  const known = m.audio.every((c) => c > 0);
  const total = m.audio.reduce((a, c) => a + c, 0);
  const tracks = m.audio.length > 1 ? m.audio.length + " tracks " : "";
  return (known ? total + " ch" : total ? "at least " + total + " ch" : "channels not known") + " · " + tracks + m.audioCodec;
}

// The newest attempt for this signal that was turned away in the last 10 seconds.
// Devices try again every second or so, so an error that stays is still going on.
function signalError(slot) {
  const now = Date.now() / 1000;
  return state.rejected.find((r) => r.slot === slot && r.short && now - r.time <= 10) || null;
}

async function disconnect(slot) {
  await change("POST", "/api/disconnect", { slot }, ["mainNote", "input disconnected"], "mainErr");
}

// ---- generated keys: the settings live on this computer (browser storage of the window), not in config.json ----
const KEY_DEFAULTS = { len: 16, letters: "mixed", exclude: "0O1lI" };
function keySettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem("srtBridgeKey") || "{}") || {}; } catch { /* storage not available: defaults */ }
  const len = Math.round(Number(s.len));
  return {
    len: len >= 10 && len <= 70 ? len : KEY_DEFAULTS.len,
    letters: ["mixed", "upper", "lower"].includes(s.letters) ? s.letters : KEY_DEFAULTS.letters,
    exclude: typeof s.exclude === "string" ? s.exclude : KEY_DEFAULTS.exclude,
  };
}
function keyAlphabet(s) {
  const lower = "abcdefghijklmnopqrstuvwxyz", upper = lower.toUpperCase();
  const all = (s.letters === "upper" ? upper : s.letters === "lower" ? lower : upper + lower) + "0123456789";
  return [...all].filter((c) => !s.exclude.includes(c));
}
function randomKey(s) {
  const chars = keyAlphabet(s);
  if (chars.length < 8) throw new Error("too few characters are left for a key: allow more in Setup");
  const limit = 256 - (256 % chars.length); // no character is more likely than another
  let key = "";
  while (key.length < s.len) {
    for (const b of crypto.getRandomValues(new Uint8Array(64))) {
      if (b < limit && key.length < s.len) key += chars[b % chars.length];
    }
  }
  return key;
}
// Fills a key field of the Edit window; Save sets it (with the usual question if devices are connected).
function generateKey(field) {
  try { $(field).value = randomKey(keySettings()); $("editErr").textContent = ""; }
  catch (e) { $("editErr").textContent = e.message; }
}
$("editGen").addEventListener("click", () => generateKey("editId"));
$("editRecvGen").addEventListener("click", () => generateKey("editRecv"));
function fillKeyForm() {
  const s = keySettings();
  $("keyLen").value = s.len;
  $("keyCase").value = s.letters;
  $("keyExclude").value = s.exclude;
}
$("keyForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const s = { len: Number($("keyLen").value), letters: $("keyCase").value, exclude: $("keyExclude").value.replace(/\s/g, "") };
  if (keyAlphabet(s).length < 8) { note("keyNote", ""); note("keyErr", "too few characters are left: allow more"); return; }
  try { localStorage.setItem("srtBridgeKey", JSON.stringify(s)); }
  catch { note("keyErr", "could not be saved on this computer"); return; }
  fillKeyForm();
  note("keyErr", "");
  note("keyNote", "saved on this computer");
  newKey("genKey", "genErr");
  newKey("rxKey", "rxErr");
});
fillKeyForm();

// ---- the Generate key page: sender key, receiver key, original on or off ----
function newKey(field, err) {
  try { put($(field), randomKey(keySettings())); note(err, ""); }
  catch (e) { put($(field), "–"); note(err, e.message); }
}
function fillSlots(sel, text) {
  const keep = sel.value;
  sel.replaceChildren(...state.places.map((p) => el("option", { value: p.slot }, "#" + p.slot + " " + label(p) + " · " + text(p))));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}
function renderKeys() {
  const ps = perSignal();
  $("genSet").disabled = $("genSlot").disabled = ps;
  $("rxSet").disabled = $("rxClear").disabled = $("rxSlot").disabled = $("origSel").disabled = ps;
  if (document.activeElement !== $("origSel")) $("origSel").value = state.noOriginal ? "off" : "allow";
  const view = [ps, state.suffixes[0], state.places.map((p) => [p.slot, label(p), p.id, p.recvId])];
  if (!changed("keys", view)) return;
  fillSlots($("genSlot"), (p) => (p.id ? "now " + p.id : "free"));
  fillSlots($("rxSlot"), (p) => (!p.id ? "free" : p.recvId ? "now " + p.recvId : "none, uses " + recvName(p)));
  put($("genHelp"), ps
    ? "With a port per signal there is no stream ID: the key can only be copied, for example as a passphrase."
    : "A new sender key disconnects the devices of that signal; they must use the new one.");
  put($("rxHelp"), ps
    ? "With a port per signal there is no stream ID: receivers use the port of the signal."
    : "With a receiver key, receivers do not need to know the sender key, and «sender key*" + state.suffixes[0] + "» no longer works. A new key disconnects the receivers of that forward output.");
  const body = el("tbody");
  for (const p of state.places) {
    const what = ps ? "UDP " + p.port : !p.id ? "– (free)" : recvName(p);
    body.append(el("tr", null,
      el("td", null, el("span", { class: "pid" }, "#" + p.slot + " " + label(p))),
      el("td", null, el("code", null, what)),
      el("td", { class: "dim" }, ps || !p.id ? "" : p.recvId ? "receiver key" : "no receiver key: sender key*" + state.suffixes[0])));
  }
  $("rxTable").replaceChildren(body);
}
$("genNew").addEventListener("click", () => newKey("genKey", "genErr"));
$("rxNew").addEventListener("click", () => newKey("rxKey", "rxErr"));
$("genCopy").addEventListener("click", () => { if ($("genKey").textContent !== "–") copy($("genKey").textContent, $("genCopy")); });
$("rxCopy").addEventListener("click", () => { if ($("rxKey").textContent !== "–") copy($("rxKey").textContent, $("rxCopy")); });
$("genSet").addEventListener("click", async () => {
  const id = $("genKey").textContent, slot = Number($("genSlot").value);
  if (id === "–") return;
  const p = state.places[slot - 1];
  const n = (p.sender ? 1 : 0) + p.receivers.length + p.forward.length;
  // The same question as in the Edit window: a new stream ID disconnects the devices of this signal.
  if (n && !confirm(count(n, "device is", "devices are") + " connected to #" + slot + ".\nA new sender key disconnects " + (n === 1 ? "it" : "them") + ". Set it now?")) return;
  await change("PUT", "/api/places", { slot, id }, ["genNote", "set for #" + slot], "genErr");
});
// No question here: only the receivers of that forward output reconnect, and they need the new key anyway.
$("rxSet").addEventListener("click", async () => {
  const recvId = $("rxKey").textContent, slot = Number($("rxSlot").value);
  if (recvId === "–") return;
  await change("PUT", "/api/places", { slot, recvId }, ["rxNote", "set for #" + slot], "rxErr");
});
$("rxClear").addEventListener("click", async () => {
  const slot = Number($("rxSlot").value);
  await change("PUT", "/api/places", { slot, recvId: "" }, ["rxNote", "removed for #" + slot], "rxErr");
});
$("origSel").addEventListener("change", async () => {
  const allow = $("origSel").value === "allow";
  await change("PUT", "/api/original", { allow }, ["genNote", allow ? "original allowed" : "original off"], "genErr");
});
newKey("genKey", "genErr");
newKey("rxKey", "rxErr");

// ---- matrix: always all signals ----
function renderMatrix() {
  const view = state.places.map((p) => [p.id, p.name, p.source, !!p.sender, p.forward.length]);
  if (!changed("mx", [view, state.suffixes[0], state.portMode, state.srtPort])) return;
  const ps = perSignal(), outWord = ps ? "output" : "forward output";
  put($("mxSub"), "· row = " + outWord + ", column = input · one input per row");
  put($("mxLeg"), "Set the matrix before the show. Changing a crosspoint reconnects the receivers of that " + outWord + ". «all ↓» gives one input to every " + outWord + "."
    + (ps ? " A row is what a device gets when it listens on the port of that signal." : " A row is fetched with the stream ID of that signal plus *" + state.suffixes[0] + "."));
  const head = el("tr", null, el("th", { class: "corner" }, outWord + " ↓  ·  input →"));
  for (const p of state.places) {
    const where = ps ? "UDP " + p.port : p.id;
    head.append(el("th", { class: p.sender ? "live" : "", title: label(p) + (where ? " · " + where : "") },
      el("span", { class: "no" }, "#" + p.slot), label(p), el("span", { class: "st" }, p.sender ? "LIVE" : inUse(p) ? "no input" : "free"),
      el("button", { type: "button", class: "allBtn", title: "give #" + p.slot + " " + label(p) + " to every " + outWord, onclick: () => setColumn(p.slot) }, "all ↓")));
  }
  const body = el("tbody");
  for (const out of state.places) {
    const n = out.forward.length;
    const addr = ps ? "UDP " + out.port : out.id ? recvName(out) : "";
    const tr = el("tr", null, el("th", { class: n ? "live" : "", title: addr },
      el("span", { class: "no" }, "#" + out.slot), label(out),
      el("span", { class: "st" }, addr ? addr + (n ? " · " + count(n, "receiver", "receivers") : "") : "free")));
    for (const inp of state.places) {
      const on = out.source === inp.slot;
      tr.append(el("td", { class: out.slot === inp.slot ? "self" : "" }, el("button", {
        type: "button", class: "cell" + (on ? " on" : ""),
        "aria-pressed": on ? "true" : "false",
        title: (ps ? "output" : "forward") + " of #" + out.slot + " " + label(out) + (on ? " gets #" : " ← #") + inp.slot + " " + label(inp),
        onclick: () => setSource(out, on ? 0 : inp.slot),
      }, on ? "ON" : "")));
    }
    body.append(tr);
  }
  $("mx").replaceChildren(el("thead", null, head), body);
}

async function setSource(out, source) {
  // No question first: a dialog can be suppressed, and then nothing would switch.
  await change("PUT", "/api/places", { slot: out.slot, source }, ["mxNote", "saved"], "mxErr");
}

// One input to every forward output. Rows that have it already are left alone.
async function setColumn(source) {
  for (const out of state.places.filter((o) => o.source !== source)) {
    if (!await change("PUT", "/api/places", { slot: out.slot, source }, ["mxNote", "saved"], "mxErr")) return;
  }
}

// ---- receivers: rows are rebuilt when a device comes or goes, otherwise only the figures change ----
const recvCells = new Map();
function renderReceivers() {
  const rows = [];
  for (const p of state.places) {
    for (const c of p.receivers) rows.push([p, "original", c]);
    for (const c of p.forward) rows.push([p, "forward", c]);
  }
  const fill = (c, cells) => {
    put(cells[0], kbps(c.mbps));
    put(cells[1], c.rttMs.toFixed(0) + " ms");
    put(cells[2], c.latencyMs + " ms");
    put(cells[3], c.recentLoss + " pkt (" + pct(c.recentLoss, c.recentPkts) + ")");
    put(cells[4], c.recentDrops + " pkt (" + pct(c.recentDrops, c.recentPkts) + ")", "num" + (c.recentDrops ? " bad" : ""));
    cells[3].title = "last minute · since connected: " + c.loss + " pkt (" + pct(c.loss, c.pkts) + ")";
    cells[4].title = "last minute · since connected: " + c.drops + " pkt (" + pct(c.drops, c.pkts) + ")";
    put(cells[5], since(c.since));
  };
  const ps = perSignal();
  if (!changed("recv", [state.portMode, state.srtPort, rows.map(([p, kind, c]) => [p.slot, p.name, p.id, p.source, kind, c.id])])) {
    for (const [, , c] of rows) if (recvCells.has(c.id)) fill(c, recvCells.get(c.id));
    return;
  }
  recvCells.clear();
  const tb = $("recvTable");
  if (!rows.length) { tb.replaceChildren(el("tr", null, el("td", { class: "empty" }, "No receiver is connected."))); return; }
  const body = el("tbody");
  for (const [p, kind, c] of rows) {
    const cells = [0, 1, 2, 3, 4, 5].map(() => el("td", { class: "num" }));
    recvCells.set(c.id, cells);
    fill(c, cells);
    const src = kind === "forward" && p.source ? state.places[p.source - 1] : null;
    body.append(el("tr", null,
      el("td", null, el("span", { class: "pid" }, "#" + p.slot + " " + label(p)), el("span", { class: "sub" }, ps ? "UDP " + p.port : kind === "forward" ? recvName(p) : p.id)),
      el("td", null, kind === "forward" ? (ps ? "" : "forward: ") + (src ? "#" + src.slot + " " + label(src) : "not assigned") : "original"),
      el("td", null, c.addr + (c.encrypted ? " · encrypted" : "")), cells));
  }
  tb.replaceChildren(el("thead", null, el("tr", null, ...["Signal", "Gets", "Device", "Bitrate", "RTT", "Latency", "Resent · 1 min", "Drops · 1 min", "Connected"].map((h, i) => el("th", { class: i > 2 ? "num" : "" }, h)))), body);
}

function renderRejected() {
  $("rejCard").hidden = !state.rejected.length;
  if (!changed("rej", state.rejected)) return;
  const body = el("tbody");
  for (const r of state.rejected) {
    body.append(el("tr", null,
      el("td", null, clock(r.time)), el("td", null, el("span", { class: "pid" }, r.streamId || "(none)")),
      el("td", null, r.addr), el("td", null, r.reason), el("td", { class: "num" }, r.count),
      el("td", { class: "acts" }, r.canAdd ? el("button", {
        type: "button", class: "sm primary",
        onclick: () => change("POST", "/api/places", { id: placeOf(r.streamId) }, ["mainNote", "added"], "mainErr"),
      }, "Use a free signal") : null)));
  }
  $("rejected").replaceChildren(el("thead", null, el("tr", null,
    ...["Last", "Stream ID", "From", "Reason", "Tries", ""].map((h) => el("th", null, h)))), body);
}

// The ID a stream ID belongs to: without the forward suffix.
function placeOf(streamId) {
  const i = streamId.lastIndexOf("*");
  if (i >= 0 && state.suffixes.includes(streamId.slice(i + 1).toLowerCase())) return streamId.slice(0, i);
  return streamId;
}

function renderEvents() {
  if (!changed("events", state.events.length ? [state.events.length, state.events[0]] : 0)) return;
  const tb = $("events");
  if (!state.events.length) { tb.replaceChildren(el("tr", null, el("td", { class: "empty" }, "Nothing yet."))); return; }
  tb.replaceChildren(...state.events.map((e) => el("tr", null, el("td", { class: "num" }, clock(e.time)), el("td", null, e.text))));
}

// ---- settings ----
function fillSettings() {
  $("setMode").value = state.portMode;
  $("setPort").value = state.srtPort;
  $("setLatency").value = state.latencyMs;
  $("setSlots").value = state.slots;
  $("setSuffixes").value = state.suffixes.join(", ");
  $("setAccept").value = state.acceptAny ? "any" : "listed";
  settingsMode();
  firewallButtons();
}

// The form follows the port mode that is chosen in it, before it is saved.
// Fields that do not apply are switched off, not removed: nothing moves.
function settingsMode() {
  const ps = $("setMode").value === "signal";
  const first = Number($("setPort").value), n = Number($("setSlots").value);
  put($("setPortLbl"), ps ? "First UDP port (signal 1)" : "UDP port (sending and receiving)");
  $("setSuffixes").disabled = $("setAccept").disabled = ps;
  put($("setSuffixesLbl"), ps ? "Forward suffixes · not used with a port per signal" : "Forward suffixes, separated by commas (the first one is used in the links)");
  put($("setAcceptLbl"), ps ? "Unknown stream IDs · not used with a port per signal" : "Unknown stream IDs");
  const span = first > 0 && n > 0 ? "UDP " + first + (n > 1 ? "–" + (first + n - 1) : "") : "the ports";
  put($("setHelp"), ps
    ? "Signals 1 to " + (n || "n") + " listen on " + span + ", one port each. A device needs no stream ID: whoever sends to a port is the input of that signal, whoever only listens there gets what the matrix assigns to it. A device that asks for a higher latency gets the higher one. A new mode, port, number of signals or latency reconnects every device; the firewall rule and the port forwarding must cover all these ports."
    : "All signals share this one port; the stream ID says which signal a device means, and the stream ID plus *forward fetches what the matrix assigns. A device that asks for a higher latency gets the higher one. A new mode, port or latency reconnects every device.");
}
for (const id of ["setMode", "setPort", "setSlots"]) $(id).addEventListener("input", settingsMode);

$("setForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const port = Number($("setPort").value), latency = Number($("setLatency").value), mode = $("setMode").value;
  const restart = port !== state.srtPort || latency !== state.latencyMs || mode !== state.portMode
    || (mode === "signal" && Number($("setSlots").value) !== state.slots);
  if (restart && !confirm("This reconnects every device. Save now?")) return;
  const oldPorts = state.portRange;
  const ok = await change("PUT", "/api/settings", {
    srtPort: port, portMode: mode, latencyMs: latency, slots: Number($("setSlots").value),
    suffixes: $("setSuffixes").value.split(","),
    acceptAny: $("setAccept").value === "any",
  }, ["setNote", "saved"], "setErr");
  if (ok) {
    fillSettings();
    if (state.portRange !== oldPorts) { note("setNote", "saved · now set the firewall rule for UDP " + range(state.portRange)); checkFirewall(); }
  }
});

// ---- internet access: firewall rule, port forwarding hint, public IP ----
// The firewall is read while the Setup page is open, not all the time.
let detectedIp = "";
async function checkFirewall() {
  if (document.querySelector('section[data-page="setup"]').hidden) return;
  try {
    const f = await api("GET", "/api/firewall");
    const ports = "UDP " + range(f.ports) + (f.webPort ? " and TCP " + f.webPort : "");
    // The same state twice: in the card «Internet access» and next to the port in the card «SRT».
    for (const n of ["", "2"]) {
      const lamp = $("fwLamp" + n), text = $("fwText" + n);
      if (f.match) { lamp.className = "lamp live"; put(text, "OPEN: rules for " + ports + " in place"); }
      else if (f.udpMatch && f.webPort) { lamp.className = "lamp wait"; put(text, "TCP " + f.webPort + " for remote access not open yet: set the rule again"); }
      else if (f.rule) { lamp.className = "lamp wait"; put(text, "OTHER PORTS: rule does not open UDP " + range(f.ports)); }
      else if (f.detail) { lamp.className = "lamp"; put(text, "could not be read: " + f.detail); }
      else { lamp.className = "lamp bad"; put(text, "CLOSED: no rule for " + ports); }
      put($("fwBtn" + n), f.match ? "Set firewall rule again" : "Set firewall rule");
    }
  } catch { /* the badge at the top already says that the bridge does not answer */ }
}

// The rule is set for the saved ports: with a new port in the form, save first.
function firewallButtons() {
  const ps = $("setMode").value === "signal";
  const unsaved = Number($("setPort").value) !== state.srtPort || $("setMode").value !== state.portMode
    || (ps && Number($("setSlots").value) !== state.slots);
  $("fwBtn2").disabled = unsaved || viewerRemote();
  $("fwBtn2").title = unsaved ? "Save the new port first; then set the rule for it" : "Opens the saved SRT port in the Windows Firewall; Windows asks for confirmation as administrator";
}
for (const id of ["setMode", "setPort", "setSlots"]) $(id).addEventListener("input", firewallButtons);

async function setFirewall(okNote, errNote) {
  try {
    await api("POST", "/api/firewall", {});
    note(okNote, "confirm in the Windows window");
  } catch (e) { note(errNote, e.message); }
}
setInterval(checkFirewall, 3000);

function renderNet() {
  const ps = perSignal(), ports = "UDP " + range(state.portRange);
  const web = state.remote && state.remote.enabled;
  put($("fwdPort"), ports + (web ? " and TCP " + state.srtPort : ""));
  put($("fwdOnly"), web ? "TCP " + state.srtPort + " is for remote access." : "Only UDP is needed.");
  put($("fwdHost"), (state.addresses.length ? state.addresses.join(" or ") : "its local address") + (ps ? ", same ports " : ", port ") + range(state.portRange));
  put($("fwHelp"), ps
    ? "Opens " + ports + " for incoming connections, one port per signal. Windows asks for confirmation as administrator. After a new first port or number of signals, add the rule again."
    : "Opens the SRT port (" + ports + ") for incoming connections. Windows asks for confirmation as administrator. After a new port, add the rule again.");
  put($("fwdHelp"), ps
    ? "All " + state.slots + " ports are needed, as a range: the port a device calls says which signal it means. Signal 1 is " + state.srtPort + ", signal " + state.slots + " is " + (state.srtPort + state.slots - 1) + "."
    : "One port is enough: every signal uses it, the stream ID tells them apart.");
  const ip = $("publicIp");
  if (!ip.dataset.edited && document.activeElement !== ip) ip.value = state.publicIp;
  const moved = state.publicIp && detectedIp && state.publicIp !== detectedIp;
  put($("ipHint"), moved
    ? "The saved public IP " + state.publicIp + " is not the one found now (" + detectedIp + "): another place? Save the new one."
    : "The address of this site on the internet. It is offered in the Links window of every signal.");
}
$("publicIp").addEventListener("input", () => { $("publicIp").dataset.edited = "1"; });

$("fwBtn").addEventListener("click", () => setFirewall("netNote", "netErr"));
$("fwBtn2").addEventListener("click", () => setFirewall("setNote", "setErr"));

$("ipDetect").addEventListener("click", async () => {
  const btn = $("ipDetect");
  btn.disabled = true;
  try {
    detectedIp = (await api("POST", "/api/public-ip/detect", {})).ip;
    $("publicIp").value = detectedIp;
    $("publicIp").dataset.edited = "1";
    note("netNote", "found " + detectedIp + ", not saved yet");
  } catch (e) { note("netErr", e.message); }
  btn.disabled = false;
});

$("ipForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const ok = await change("PUT", "/api/public-ip", { ip: $("publicIp").value.trim() }, ["netNote", "saved"], "netErr");
  if (ok) { delete $("publicIp").dataset.edited; $("publicIp").value = state.publicIp; }
});

$("rejClear").addEventListener("click", () => change("DELETE", "/api/rejected", {}, null, "mainErr"));

// ---- links ----
let linkSlot = 0;
function openLinks(slot) {
  linkSlot = slot;
  const sel = $("linkAddr");
  const keep = sel.value;
  const local = state.addresses.length ? state.addresses : ["127.0.0.1"];
  sel.replaceChildren(...local.map((a) => el("option", { value: a }, a + " · local network")));
  if (state.publicIp) sel.append(el("option", { value: state.publicIp }, state.publicIp + " · internet (public IP)"));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
  drawLinks();
  if (!$("linkDlg").open) $("linkDlg").showModal();
}

function drawLinks() {
  const p = state.places[linkSlot - 1];
  if (!p || !inUse(p)) return;
  $("linkTitle").textContent = "Links for #" + p.slot + " " + label(p);
  const host = $("linkAddr").value + ":" + p.port;
  const play = (u) => "https://play.haivision.com/play?url=" + encodeURIComponent(u.replace("streamid=", "StreamID=").replace("latency=", "Latency="));
  let rows;
  if (perSignal()) {
    // The port is the address of the signal: one link for sending and for receiving, no stream ID.
    const u = "srt://" + host + "?latency=" + state.latencyMs + (p.passIn ? "&passphrase=" + encodeURIComponent(p.passIn) : "");
    const src = p.source ? state.places[p.source - 1] : null;
    rows = [
      ["Send to this signal (caller, no stream ID)", u],
      ["Receive on this port (caller, same address): what the matrix assigns, now " + (src ? "#" + src.slot + " " + label(src) : "nothing"), u],
      ["Haivision Play: receive", play(u)],
    ];
  } else {
    const url = (streamId, pass) => "srt://" + host + "?streamid=" + encodeURIComponent(streamId) + "&latency=" + state.latencyMs + (pass ? "&passphrase=" + encodeURIComponent(pass) : "");
    const bare = url(p.id, p.passIn), fwd = url(recvName(p), p.passFwd);
    const fwdWhat = "Receive the forward output (caller" + (p.recvId ? ", receiver key" : "") + "): what the matrix assigns";
    rows = state.noOriginal ? [
      ["Send to this signal (caller, sender key; receiving the original is off)", bare],
      [fwdWhat, fwd],
      ["Haivision Play: forward output", play(fwd)],
    ] : [
      ["Send to this signal, or receive its original (caller, same address for both)", bare],
      [fwdWhat, fwd],
      ["Haivision Play: original", play(bare)],
      ["Haivision Play: forward output", play(fwd)],
    ];
  }
  $("linkList").replaceChildren(...rows.map(([what, link]) => {
    const btn = el("button", { type: "button", class: "sm" }, "Copy");
    btn.addEventListener("click", () => copy(link, btn));
    const qr = el("button", { type: "button", class: "sm", onclick: () => openQr(what, link) }, "QR code");
    return el("div", { class: "link" }, el("div", { class: "what" }, what), el("code", null, link), el("div", { class: "linkBtns" }, btn, qr));
  }));
}

// The QR code is drawn by the bridge itself (no internet needed) and shown in a small window.
let qrUrl = "";
let qrCtx = { slot: 0, mode: "text", what: "", rawLink: "" };

function populateQrHosts() {
  const sel = $("qrHostSel");
  if (!sel || !state) return;
  const keep = sel.value || quickHost();
  const local = sortedLocalAddrs();
  const opts = [];
  for (const a of local) opts.push(el("option", { value: a }, a + " · Wi-Fi Local"));
  if (state.publicIp) opts.push(el("option", { value: state.publicIp }, state.publicIp + " · Internet 4G/5G"));
  sel.replaceChildren(...opts);
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

function buildQrPayload() {
  if (!qrCtx.slot) {
    return { title: qrCtx.what || "Código QR", payload: qrCtx.rawLink, hint: "Escanea el código QR con tu celular." };
  }
  const p = state.places[qrCtx.slot - 1];
  const isFwd = $("qrRoleSel") && $("qrRoleSel").value === "stu";
  const hostIp = ($("qrHostSel") && $("qrHostSel").value) || quickHost();
  const srtUrl = buildSrtUrlForHost(p, isFwd, hostIp);
  const chanName = "#" + p.slot + " " + label(p) + (isFwd ? " (Estudio)" : " (Cámara)");
  const sid = perSignal() ? "(sin Stream ID)" : (isFwd ? recvName(p) : p.id);

  if (qrCtx.mode === "larix") {
    const rawHost = "srt://" + hostIp + ":" + p.port;
    let larixUrl = "larix://set/v1?conn[][url]=" + encodeURIComponent(rawHost)
      + "&conn[][name]=" + encodeURIComponent("SRT " + chanName)
      + "&conn[][srtmode]=c"
      + "&conn[][srtlatency]=" + state.latencyMs;
    if (sid && !perSignal()) {
      larixUrl += "&conn[][srtstreamid]=" + encodeURIComponent(sid);
    }
    const pass = isFwd ? p.passFwd : p.passIn;
    if (pass) {
      larixUrl += "&conn[][srtpass]=" + encodeURIComponent(pass);
    }
    return {
      title: "QR Larix · " + chanName,
      payload: larixUrl,
      hint: "En Larix Broadcaster ve a Ajustes -> Acción -> Escanear código QR para importar automáticamente."
    };
  }
  if (qrCtx.mode === "haivision") {
    const hvUrl = "https://play.haivision.com/play?url=" + encodeURIComponent(srtUrl.replace("streamid=", "StreamID=").replace("latency=", "Latency="));
    return {
      title: "QR Haivision · " + chanName,
      payload: hvUrl,
      hint: "Enlace web https:// compatible con cualquier cámara de celular y Haivision Play Pro."
    };
  }
  if (qrCtx.mode === "raw") {
    return {
      title: "QR SRT Puro · " + chanName,
      payload: srtUrl,
      hint: "URI srt:// directo. Nota: la cámara nativa de Android puede decir 'sin datos' si ninguna app registra srt://; usa 'Cámara Celular (Texto)' para copiar."
    };
  }
  const textCard = [
    "SRT Bridge · " + chanName,
    srtUrl,
    "Servidor: srt://" + hostIp + ":" + p.port,
    "Stream ID: " + sid,
    "Latencia: " + state.latencyMs + " ms"
  ].join("\n");
  return {
    title: "QR Celular · " + chanName,
    payload: textCard,
    hint: "Escanea con la cámara normal de tu Android o iPhone: se abrirá como texto listo para tocar 'Copiar' sin error."
  };
}

async function refreshQrImage() {
  const { title, payload, hint } = buildQrPayload();
  const res = await fetch("/api/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: payload }) });
  if (!res.ok) throw new Error((await res.text()).trim() || "no QR code");
  if (qrUrl) URL.revokeObjectURL(qrUrl);
  qrUrl = URL.createObjectURL(await res.blob());
  $("qrImg").src = qrUrl;
  $("qrTitle").textContent = title;
  $("qrText").textContent = payload;
  if ($("qrHint")) $("qrHint").textContent = hint;
}

async function openSlotQr(slot) {
  qrCtx = { slot, mode: qrCtx.mode || "text", what: "", rawLink: "" };
  if ($("qrControls")) $("qrControls").hidden = false;
  populateQrHosts();
  for (const b of document.querySelectorAll("#qrModeTabs button[data-qrmode]")) {
    b.classList.toggle("on", b.dataset.qrmode === qrCtx.mode);
  }
  try {
    await refreshQrImage();
    if (!$("qrDlg").open) $("qrDlg").showModal();
  } catch (e) { alert("QR: " + e.message); }
}

async function openQr(what, link) {
  const isHttp = link.startsWith("http://") || link.startsWith("https://");
  qrCtx = { slot: 0, mode: isHttp ? "raw" : "text", what, rawLink: isHttp ? link : ("SRT Bridge · " + what + "\n" + link) };
  if ($("qrControls")) $("qrControls").hidden = true;
  try {
    await refreshQrImage();
    if (!$("qrDlg").open) $("qrDlg").showModal();
  } catch (e) { alert("QR: " + e.message); }
}

if ($("qrModeTabs")) {
  $("qrModeTabs").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-qrmode]");
    if (!btn) return;
    qrCtx.mode = btn.dataset.qrmode;
    for (const b of document.querySelectorAll("#qrModeTabs button[data-qrmode]")) b.classList.toggle("on", b === btn);
    refreshQrImage().catch(() => {});
  });
}
if ($("qrRoleSel")) $("qrRoleSel").addEventListener("change", () => refreshQrImage().catch(() => {}));
if ($("qrHostSel")) $("qrHostSel").addEventListener("change", () => refreshQrImage().catch(() => {}));
$("linkAddr").addEventListener("change", drawLinks);

// ---- remote access: this interface over HTTPS on TCP <SRT port> ----
const viewerRemote = () => !!state.remote && state.remote.viewer === "remote";
function remoteUrl() {
  const host = state.publicIp || (viewerRemote() ? location.hostname : state.addresses[0]) || "address-of-this-pc";
  return "https://" + host + ":" + state.remote.port + "/";
}
function renderRemote() {
  const r = state.remote;
  if (!r) return;
  const remote = viewerRemote();
  $("logoutBtn").hidden = !remote;
  const lamp = $("rmLamp");
  if (r.error) { lamp.className = "lamp bad"; put($("rmText"), "ERROR: " + r.error); }
  else if (r.listening) { lamp.className = "lamp live"; put($("rmText"), "ON: HTTPS on TCP " + r.port); }
  else { lamp.className = "lamp"; put($("rmText"), "OFF"); }
  put($("rmToggle"), r.enabled ? "Switch off" : "Switch on");
  $("rmToggle").disabled = remote || (!r.enabled && !r.hasPassword);
  put($("rmHelp"), remote
    ? "You are connected over remote access. Remote access itself, the SRT port and the firewall can only be changed on the bridge PC."
    : !r.hasPassword ? "Set a password first, then switch remote access on."
    : r.enabled ? "Also needed: the firewall rule for TCP " + r.port + " (Internet access, set the rule again) and, in the router, TCP " + r.port + " forwarded to this PC next to UDP. Whoever has the password can change everything except remote access, the SRT port and the firewall."
    : "Switched on, the bridge answers on TCP " + r.port + " over HTTPS, the same number as the SRT port. Off, nothing listens there.");
  put($("rmPassHelp"), remote ? "The password can only be changed on the bridge PC." : r.hasPassword ? "A password is set. A new one logs out everybody who is logged in." : "No password set yet.");
  $("rmPass").disabled = $("rmPass2").disabled = $("rmPassForm").querySelector("button").disabled = remote;
  put($("rmUrl"), remoteUrl());
  put($("rmFp"), r.fingerprint || "–");
  put($("rmToken"), remote ? "only shown on the bridge PC" : r.apiToken || "–");
  $("rmTokenNew").disabled = $("rmTokenCopy").disabled = remote;
  // Over remote access the port stays as it is (it is the viewer's port too), and the firewall belongs to the bridge PC.
  $("setPort").disabled = $("setMode").disabled = $("fwBtn").disabled = remote;
}

async function remoteChange(body, okText) {
  try {
    render(await api("PUT", "/api/remote", body));
    note("rmNote", okText);
    checkFirewall();
    return true;
  } catch (e) { note("rmErr", e.message); return false; }
}
$("rmToggle").addEventListener("click", () => remoteChange({ enabled: !state.remote.enabled },
  state.remote.enabled ? "switched off" : "switched on · now set the firewall rule again"));
$("rmPassForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("rmPass").value !== $("rmPass2").value) { note("rmErr", "the two passwords are not the same"); return; }
  if (await remoteChange({ password: $("rmPass").value }, "password set")) $("rmPass").value = $("rmPass2").value = "";
});
$("rmTokenNew").addEventListener("click", () => remoteChange({ newToken: true }, "new token, the old one no longer works"));
$("rmTokenCopy").addEventListener("click", () => copy(state.remote.apiToken, $("rmTokenCopy")));
$("rmUrlCopy").addEventListener("click", () => copy(remoteUrl(), $("rmUrlCopy")));
$("rmUrlQr").addEventListener("click", () => openQr("Remote access", remoteUrl()));

// ---- start with Windows ----
function renderAutostart() {
  const a = state.autostart;
  if (!a) return;
  if (document.activeElement !== $("asOn")) $("asOn").checked = a.on;
  put($("asHelp"), a.other
    ? "The entry starts another copy: " + a.other + ". Tick it again to start this one."
    : a.on ? "SRT Bridge starts when this Windows user logs in." : "SRT Bridge starts only by hand.");
}
$("asOn").addEventListener("change", () => change("PUT", "/api/autostart", { on: $("asOn").checked },
  ["asNote", "saved"], "asErr"));

// ---- Bridge Output: start, stop, an output per signal ----
const OUT_KINDS = [["off", "Off"], ["omt", "OMT"], ["ndi", "NDI"]];
const opRows = [];

// The choice: Off/OMT/NDI, then the SDI ports. A port another signal uses cannot be chosen;
// a port that is set but not found stays in the list, so the setting stays visible.
function fillOutChoice(sel, ports, current, signals, slot) {
  const used = {};
  for (const s of signals) if (s.slot !== slot && s.out.startsWith("sdi:")) used[s.out] = s.slot;
  const options = OUT_KINDS.map(([value, label]) => ({ value, label, disabled: false }));
  for (const p of ports) {
    const value = "sdi:" + p.key;
    let text = "SDI " + p.name;
    if (used[value]) text += " (signal " + used[value] + ")";
    else if (p.busy) text += " (in use)";
    options.push({ value, label: text, disabled: !!used[value] });
  }
  if (!ports.length) options.push({ value: "", label: "SDI: no Blackmagic card found", disabled: true });
  if (current.startsWith("sdi:") && !options.some((o) => o.value === current))
    options.push({ value: current, label: "SDI port not found", disabled: false });
  const sig = JSON.stringify(options);
  if (sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  sel.replaceChildren(...options.map((o) => el("option", { value: o.value, disabled: o.disabled }, o.label)));
}

function decoderText(s) {
  const e = s.engine;
  if (s.out === "off") return ["", false];
  if (!e) return ["starting…", false];
  if (e.state === "checking") return ["checking that the name is free on the network…", false];
  if (e.problem && !e.pictures) return [e.problem, true];
  const sdi = s.out.startsWith("sdi:");
  if (e.state === "waiting") return [sdi ? "waiting for the signal" : "on air, waiting for the signal", false];
  if (e.state === "starting") return ["signal arrives, waiting for the first picture", false];
  const parts = [e.video, e.fps + " fps", e.audio ? e.audio : "no sound"];
  if (sdi) parts.push(e.sdi ? "SDI " + e.sdi : "SDI starting…");
  else parts.push(count(e.receivers, "receiver", "receivers"));
  if (e.gaps) parts.push(e.gaps + " gaps");
  if (e.errors) parts.push(e.errors + " errors");
  if (e.problem) return [e.problem + " · " + parts.join(" · "), true];
  return [parts.join(" · "), false];
}

async function saveOut(slot, r) {
  try {
    render(await api("PUT", "/api/output/out", { slot, out: r.sel.value, name: r.name.value.trim() }));
    r.error = "";
    note("ooNote", "saved");
  } catch (e) {
    r.error = e.message;
    put(r.dec, e.message, "dec bad");
    note("ooErr", e.message);
  }
}

function makeOutRow(slot) {
  const r = { error: "" };
  r.lamp = el("span", { class: "lamp" }, el("i"), r.word = el("span", null, "no signal"));
  r.bridge = el("td");
  r.sel = el("select", { class: "opSel" });
  r.name = el("input", { class: "opName", maxlength: 60, spellcheck: "false", autocomplete: "off" });
  r.dec = el("td", { class: "dec" });
  r.sel.addEventListener("change", () => saveOut(slot, r));
  r.name.addEventListener("change", () => saveOut(slot, r));
  r.name.addEventListener("keydown", (ev) => { if (ev.key === "Enter") r.name.blur(); });
  r.tr = el("tr", null, el("td", { class: "sigLamp" }, r.lamp), el("td", { class: "num" }, String(slot)), r.bridge, el("td", null, r.sel), el("td", null, r.name), r.dec);
  return r;
}

function renderOutputs() {
  const o = state.output;
  if (!o) return;
  const st = o.running ? o.state : null;
  const lamp = $("opLamp");
  if (o.running) { lamp.className = "lamp live"; put($("opText"), "RUNNING" + (st ? " · version " + st.version : "") + (o.ours ? " · started by the bridge" : " · started by hand")); }
  else if (o.want && o.found) { lamp.className = "lamp wait"; put($("opText"), "STARTING"); }
  else if (!o.found) { lamp.className = "lamp bad"; put($("opText"), "NOT FOUND: " + (o.path || "srt-bridge-output.exe is not next to the bridge")); }
  else { lamp.className = "lamp"; put($("opText"), "STOPPED"); }
  if (o.error && !o.running) { lamp.className = "lamp bad"; put($("opText"), "ERROR: " + o.error); }
  $("opStart").disabled = o.running || !o.found;
  $("opStop").disabled = !o.running;
  const cards = st && st.cards || [];
  put($("opInfo"), !st ? (o.found ? "Program: " + o.path : " ")
    : (cards.length ? cards.map((c) => c.model + " found, " + count(c.ports, "SDI port", "SDI ports")).join(" · ") : "no SDI card")
      + (st.bridgeOk ? "" : " · it does not reach the bridge at " + st.bridgeUrl));
  if (document.activeElement !== $("opAuto")) $("opAuto").checked = o.auto;

  // The table: one row per signal of the bridge, also while the program is stopped (then switched off).
  const tb = $("opTable");
  const signals = st ? st.signals.filter((s) => s.slot <= state.slots) : state.places.map((p) => ({ slot: p.slot, name: label(p), live: !!p.sender, out: "off", outName: "", engine: null }));
  if (changed("opRows", signals.length)) {
    opRows.length = 0;
    const body = el("tbody");
    for (const s of signals) { const r = makeOutRow(s.slot); opRows.push(r); body.append(r.tr); }
    tb.replaceChildren(el("thead", null, el("tr", null, ...["Signal", "#", "Bridge name", "Output", "Output name", "Decoder"].map((h) => el("th", null, h)))), body);
  }
  for (const s of signals) {
    const r = opRows[s.slot - 1];
    if (!r) continue;
    const p = state.places[s.slot - 1];
    const live = p ? !!p.sender : s.live;
    put(r.word, live ? "SIGNAL" : "no signal", "");
    r.lamp.className = "lamp" + (live ? " live" : "");
    put(r.bridge, p ? label(p) : s.name || "");
    r.sel.disabled = r.name.disabled = !st;
    if (st && document.activeElement !== r.sel) {
      fillOutChoice(r.sel, st.ports || [], s.out, st.signals, s.slot);
      r.sel.value = s.out;
    }
    const sdi = s.out.startsWith("sdi:");
    if (st) r.name.disabled = sdi;
    r.name.title = sdi ? "not used for SDI" : "";
    if (document.activeElement !== r.name && !r.error) r.name.value = s.outName;
    if (r.error) continue; // the reason why it was not saved stays until it is corrected
    const [text, bad] = st ? decoderText(s) : ["", false];
    put(r.dec, text, "dec" + (bad ? " bad" : ""));
    r.dec.title = text;
  }

  // Which program the bridge starts: only on the bridge PC.
  const remote = viewerRemote();
  const path = $("opPath");
  if (!path.dataset.edited && document.activeElement !== path) path.value = o.custom;
  path.disabled = $("opPathForm").querySelector("button").disabled = remote;
  put($("opPathHelp"), remote ? "The program path can only be changed on the bridge PC."
    : o.custom ? (o.found ? "Started from this path." : "Not found at this path.")
    : o.found ? "Found next to the bridge: " + o.path : "Not found next to the bridge (folder output). Install it with the bridge setup, or enter the path of srt-bridge-output.exe.");
}

$("opStart").addEventListener("click", () => change("POST", "/api/output/start", {}, ["opNote", "starting"], "opErr"));
$("opStop").addEventListener("click", () => change("POST", "/api/output/stop", {}, ["opNote", "stopped"], "opErr"));
$("opAuto").addEventListener("change", () => change("PUT", "/api/output/settings", { auto: $("opAuto").checked, path: state.output.custom },
  ["opNote", "saved"], "opErr"));
$("opPath").addEventListener("input", () => { $("opPath").dataset.edited = "1"; });
$("opPathForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (await change("PUT", "/api/output/settings", { auto: state.output.auto, path: $("opPath").value.trim() }, ["opPathNote", "saved"], "opPathErr"))
    delete $("opPath").dataset.edited;
});

// ---- edit a signal ----
let editSlot = 0;
function openEdit(slot) {
  const p = state.places[slot - 1];
  editSlot = slot;
  $("editTitle").textContent = "Signal #" + slot;
  $("editName").value = p.name;
  $("editName").placeholder = "Line " + slot;
  $("editId").value = p.id;
  $("editPassIn").value = p.passIn;
  $("editPassFwd").value = p.passFwd;
  $("editRecv").value = p.recvId;
  // With a port per signal there is no stream ID and one passphrase for the port.
  const ps = perSignal();
  $("editId").disabled = $("editPassFwd").disabled = $("editGen").disabled = $("editRecv").disabled = $("editRecvGen").disabled = ps;
  put($("editIdLbl"), ps ? "Sender key · not used, the port is UDP " + p.port : "Sender key (stream ID) · empty = the signal is free");
  put($("editRecvLbl"), ps ? "Receiver key · not used" : "Receiver key · empty = sender key*" + state.suffixes[0]);
  put($("editPassInLbl"), ps ? "Passphrase for this port · empty = none" : "Passphrase: input and original · empty = none");
  put($("editPassFwdLbl"), ps ? "Passphrase: forward output · not used" : "Passphrase: forward output · empty = none");
  put($("editHelp"), ps
    ? "A passphrase has 10 to 79 characters and applies to the sender and to the receivers on this port. A new passphrase reconnects the devices of this signal."
    : "A passphrase has 10 to 79 characters. A new key or passphrase reconnects the devices that use it.");
  $("editErr").textContent = "";
  $("editDlg").showModal();
}
$("editForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const p = state.places[editSlot - 1];
  const id = $("editId").value.trim();
  const n = (p.sender ? 1 : 0) + p.receivers.length + p.forward.length;
  if (perSignal()) {
    try {
      render(await api("PUT", "/api/places", { slot: editSlot, name: $("editName").value.trim(), passIn: $("editPassIn").value }));
      $("editDlg").close();
      note("mainNote", "saved");
    } catch (e) { $("editErr").textContent = e.message; }
    return;
  }
  if (id !== p.id && n && !confirm(count(n, "device is", "devices are") + " connected to this signal.\n" + (id ? "A new stream ID" : "Clearing the signal") + " disconnects " + (n === 1 ? "it" : "them") + ". Save now?")) return;
  try {
    render(await api("PUT", "/api/places", {
      slot: editSlot, name: $("editName").value.trim(), id,
      passIn: id ? $("editPassIn").value : "", passFwd: id ? $("editPassFwd").value : "",
      recvId: id ? $("editRecv").value.trim() : "",
    }));
    $("editDlg").close();
    note("mainNote", "saved");
  } catch (e) { $("editErr").textContent = e.message; }
});

for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", () => b.closest("dialog").close());

// ---- pages, clock, polling ----
$("nav").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-go]");
  if (!btn) return;
  const go = btn.dataset.go;
  for (const b of $("nav").querySelectorAll("button[data-go]")) b.classList.toggle("on", b === btn);
  for (const s of document.querySelectorAll("section[data-page]")) s.hidden = s.dataset.page !== go;
  checkFirewall();
});

setInterval(() => { $("clock").textContent = new Date().toLocaleTimeString("de-CH"); }, 500);

async function poll() {
  if (!loginOpen) {
    try {
      const data = await api("GET", "/api/state");
      render(data);
    } catch (err) {
      console.error("poll / render error:", err);
      if (!loginOpen) put($("portBadge"), tr("no_answer", "Sin respuesta de SRT Bridge"), "chBadge bad");
    }
  }
  setTimeout(poll, 1000);
}

if ($("langEn")) $("langEn").addEventListener("click", () => setLanguage("en"));
if ($("langEs")) $("langEs").addEventListener("click", () => setLanguage("es"));
applyLanguageToDOM();

poll();

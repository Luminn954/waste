// ============================================================
//  app.js — SmartWaste v2.0
//  Fitur: Search, Edit, Export CSV, Notifikasi, Chart, Dark Mode
// ============================================================

const DEFAULT_LOCAL_API = "http://localhost:8090";
const configuredApi = document.querySelector('meta[name="smartwaste-api-url"]')?.content.trim();
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const API = (configuredApi || (
  location.protocol === "file:" || localHosts.has(location.hostname)
    ? DEFAULT_LOCAL_API
    : location.origin
)).replace(/\/+$/, "");

// Cache data untuk search/filter
let _sampahData    = [];
let _petugasData   = [];
let _kendaraanData = [];

// ── Tanggal di topbar ── (diisi setelah BULAN_ID & HARI_ID didefinisikan di bawah)
let _dateEl = document.getElementById("current-date");
// placeholder dulu, akan diisi setelah konstanta kalender terdefinisi

// ============================================================
//  KALENDER INTERAKTIF
// ============================================================
const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI_ID  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// Isi tanggal topbar sekarang konstanta sudah ada
const _now = new Date();
if (_dateEl) _dateEl.textContent =
  `${HARI_ID[_now.getDay()]}, ${_now.getDate()} ${BULAN_ID[_now.getMonth()]} ${_now.getFullYear()}`;

let calDate     = new Date();      // bulan yang ditampilkan
let calSelected = null;            // tanggal yang dipilih

const calBtn   = document.getElementById("cal-btn");
const calPanel = document.getElementById("cal-panel");
const calGrid  = document.getElementById("cal-grid");
const calLabel = document.getElementById("cal-month-label");

function renderCalendar() {
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  const today = new Date();

  calLabel.textContent = `${BULAN_ID[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay(); // 0=Min
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays    = new Date(y, m, 0).getDate();

  let html = "";

  // Isi hari kosong dari bulan sebelumnya
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    html += `<button class="cal-day other-month" data-date="${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}">${d}</button>`;
  }

  // Isi hari bulan ini
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getDate()===d && today.getMonth()===m && today.getFullYear()===y;
    const isSel   = calSelected && calSelected === dateStr;
    let cls = "cal-day";
    if (isToday) cls += " today";
    if (isSel)   cls += " selected";
    html += `<button class="${cls}" data-date="${dateStr}">${d}</button>`;
  }

  // Isi sisa kotak dengan bulan berikutnya
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<button class="cal-day other-month">${d}</button>`;
  }

  calGrid.innerHTML = html;

  // Event klik tiap tanggal
  calGrid.querySelectorAll(".cal-day[data-date]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dateStr = btn.dataset.date;
      calSelected = dateStr;
      renderCalendar();

      // Format tanggal ke Indonesia untuk isi form laporan
      const [ty, tm, td] = dateStr.split("-").map(Number);
      const tgl = new Date(ty, tm-1, td);
      const formatted = `${td} ${BULAN_ID[tm-1]} ${ty}`;

      // Isi input tanggal laporan otomatis
      const inputLaporan = document.getElementById("inp-laporan-tanggal");
      if (inputLaporan) inputLaporan.value = formatted;

      toast(`Tanggal dipilih: ${formatted}. Buka Laporan untuk membuat laporan.`, "success");

      // Tutup kalender
      calPanel.classList.remove("open");
      calBtn.classList.remove("cal-btn-active");
    });
  });
}

// Toggle kalender
calBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = calPanel.classList.contains("open");

  // Tutup panel lain
  document.getElementById("profile-panel")?.classList.remove("open");
  document.getElementById("notif-panel")?.classList.remove("open");

  if (isOpen) {
    calPanel.classList.remove("open");
    calBtn.classList.remove("cal-btn-active");
  } else {
    calDate = new Date(); // reset ke bulan sekarang
    renderCalendar();
    calPanel.classList.add("open");
    calBtn.classList.add("cal-btn-active");
  }
});

// Navigasi bulan sebelumnya
document.getElementById("cal-prev").addEventListener("click", (e) => {
  e.stopPropagation();
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});

// Navigasi bulan berikutnya
document.getElementById("cal-next").addEventListener("click", (e) => {
  e.stopPropagation();
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

// Tombol "Hari ini"
document.getElementById("cal-today").addEventListener("click", (e) => {
  e.stopPropagation();
  calDate = new Date();
  calSelected = null;
  renderCalendar();
});

// Tutup kalender klik di luar
document.addEventListener("click", (e) => {
  if (!calPanel.contains(e.target) && e.target !== calBtn) {
    calPanel.classList.remove("open");
    calBtn.classList.remove("cal-btn-active");
  }
});

// ============================================================
//  PROFILE DROPDOWN
// ============================================================
const profileBtn   = document.getElementById("profile-btn");
const profilePanel = document.getElementById("profile-panel");

profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = profilePanel.classList.contains("open");

  // Tutup panel lain
  calPanel.classList.remove("open");
  calBtn.classList.remove("cal-btn-active");
  document.getElementById("notif-panel")?.classList.remove("open");

  profilePanel.classList.toggle("open", !isOpen);
});

// Shortcut navigasi di profile dropdown
document.querySelectorAll(".pp-shortcut[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    profilePanel.classList.remove("open");

    // Trigger navigasi
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.click();
    else {
      // Manual navigate jika nav link tidak tersedia
      document.querySelectorAll(".nav-link[data-page]").forEach(l => l.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      const target = document.getElementById("page-" + page);
      if (target) target.classList.add("active");
      syncBottomNav(page);
      const loaders = { dashboard:loadDashboard, sampah:loadSampah, petugas:loadPetugas, kendaraan:loadKendaraan, tpa:loadTPA, laporan:loadLaporan, analytics:loadAnalytics };
      if (loaders[page]) loaders[page]();
    }
  });
});

// Tutup profile klik di luar
document.addEventListener("click", (e) => {
  if (!profilePanel.contains(e.target) && e.target !== profileBtn) {
    profilePanel.classList.remove("open");
  }
});

// ============================================================
//  1. DARK MODE TOGGLE
// ============================================================
const html      = document.documentElement;
const darkBtn   = document.getElementById("dark-toggle");
const darkIcon  = document.getElementById("dark-icon");

// Ambil preferensi tersimpan
(function initTheme() {
  const saved = localStorage.getItem("sw-theme") || "light";
  html.setAttribute("data-theme", saved);
  darkIcon.className = saved === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
})();

darkBtn.addEventListener("click", () => {
  const isDark = html.getAttribute("data-theme") === "dark";
  const next   = isDark ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("sw-theme", next);
  darkIcon.className = next === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  toast(`Mode ${next === "dark" ? "gelap" : "terang"} aktif`, "success");
});

// ============================================================
//  2. NOTIFIKASI BELL
// ============================================================
const notifBtn   = document.getElementById("notif-btn");
const notifPanel = document.getElementById("notif-panel");
const notifDot   = document.getElementById("notif-dot");
const notifList  = document.getElementById("notif-list");

notifBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  const isOpen = notifPanel.classList.contains("open");
  if (isOpen) { notifPanel.classList.remove("open"); return; }
  notifPanel.classList.add("open");
  await loadNotifikasi();
});

document.addEventListener("click", (e) => {
  if (!notifPanel.contains(e.target) && e.target !== notifBtn)
    notifPanel.classList.remove("open");
});

async function loadNotifikasi() {
  try {
    const d = await api("GET", "/notifikasi");
    const items = d.items || [];

    // Tampilkan dot merah jika ada warning/danger
    const hasAlert = items.some(i => i.level === "warning" || i.level === "danger");
    notifDot.classList.toggle("show", hasAlert);

    notifList.innerHTML = items.map(n => {
      const lvl = n.level === "danger" ? "danger" : n.level === "warning" ? "warning" : "success";
      return `<div class="notif-item">
        <div class="notif-icon ${lvl}"><i class="fa-solid ${n.icon}"></i></div>
        <span class="notif-text">${n.pesan}</span>
      </div>`;
    }).join("");
  } catch {
    notifList.innerHTML = `<div class="notif-item"><span class="notif-text" style="color:var(--re)">Gagal memuat notifikasi</span></div>`;
  }
}

// Cek notifikasi saat init (untuk dot)
async function cekNotifDot() {
  try {
    const d = await api("GET", "/notifikasi");
    const hasAlert = (d.items || []).some(i => i.level === "warning" || i.level === "danger");
    notifDot.classList.toggle("show", hasAlert);
  } catch {}
}

// ============================================================
//  NAVIGASI
// ============================================================
const PAGE_LABELS = {
  dashboard:"Dashboard", sampah:"Daftar Sampah",
  petugas:"Data Petugas", kendaraan:"Armada Kendaraan",
  tpa:"Tempat Pembuangan Akhir", laporan:"Laporan Harian",
};

document.querySelectorAll(".nav-link[data-page]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const page = link.dataset.page;
    if (!page) return;
    document.querySelectorAll(".nav-link[data-page]").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");
    document.getElementById("nav-links").classList.remove("open");
    // Sync bottom nav
    syncBottomNav(page);
    const loaders = { dashboard:loadDashboard, sampah:loadSampah, petugas:loadPetugas, kendaraan:loadKendaraan, tpa:loadTPA, laporan:loadLaporan, analytics:loadAnalytics };
    if (loaders[page]) loaders[page]();
  });
});

// Klik card dashboard → pindah halaman
document.querySelectorAll(".sc-clickable[data-goto]").forEach(card => {
  card.addEventListener("click", () => {
    const lnk = document.querySelector(`.nav-link[data-page="${card.dataset.goto}"]`);
    if (lnk) lnk.click();
  });
});

// Mobile menu toggle
document.getElementById("nav-toggle").addEventListener("click", () => {
  document.getElementById("nav-links").classList.toggle("open");
});

// ============================================================
//  BOTTOM NAV (mobile)
// ============================================================
document.querySelectorAll(".bottom-nav .bn-item[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (!page) return;

    // Sync topnav active state
    document.querySelectorAll(".nav-link[data-page]").forEach(l => l.classList.remove("active"));
    const topLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (topLink) topLink.classList.add("active");

    // Sync bottom nav active state
    document.querySelectorAll(".bn-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Ganti halaman
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");

    // Tutup mobile menu kalau terbuka
    document.getElementById("nav-links").classList.remove("open");

    // Load data
    const loaders = {
      dashboard: loadDashboard, sampah: loadSampah,
      petugas: loadPetugas, kendaraan: loadKendaraan,
      tpa: loadTPA, laporan: loadLaporan,
    };
    if (loaders[page]) loaders[page]();

    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// Sync bottom nav saat topnav diklik
function syncBottomNav(page) {
  document.querySelectorAll(".bn-item").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
}

// ============================================================
//  API HELPER
// ============================================================
function updateSystemStatus(apiOnline, databaseOnline) {
  const setStatus = (id, label, state) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = label;
    el.classList.remove("status-checking", "status-online", "status-offline");
    el.classList.add(`status-${state}`);
  };

  const apiState = apiOnline === null ? "checking" : apiOnline ? "online" : "offline";
  const databaseState = databaseOnline === null ? "checking" : databaseOnline ? "online" : "offline";
  setStatus("api-status", apiState === "checking" ? "Memeriksa..." : apiState === "online" ? "Online" : "Offline", apiState);
  setStatus("database-status", databaseState === "checking" ? "Memeriksa..." : databaseState === "online" ? "Terhubung" : "Offline", databaseState);

  const hero = document.getElementById("system-status");
  const icon = document.getElementById("system-status-icon");
  const text = document.getElementById("system-status-text");
  if (!hero || !icon || !text) return;

  const heroState = apiOnline === false || databaseOnline === false
    ? "offline"
    : apiOnline === true && databaseOnline === true
      ? "online"
      : "checking";
  const heroCopy = {
    checking: ["Memeriksa koneksi...", "fa-spinner fa-spin"],
    online: ["Sistem berjalan normal", "fa-circle-check"],
    offline: [apiOnline === false ? "Backend tidak aktif" : "Database tidak terhubung", "fa-circle-exclamation"],
  }[heroState];

  hero.classList.remove("status-checking", "status-online", "status-offline");
  hero.classList.add(`status-${heroState}`);
  text.textContent = heroCopy[0];
  icon.className = `fa-solid ${heroCopy[1]}`;
}

async function api(method, path, body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  let res;
  try { res = await fetch(API + path, opts); }
  catch {
    updateSystemStatus(false, false);
    throw new Error("Tidak bisa terhubung ke server. Jalankan backend terlebih dahulu.");
  }

  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (path === "/") updateSystemStatus(false, false);
    if (path === "/dashboard") updateSystemStatus(true, false);
    throw new Error(data.detail || "Terjadi kesalahan");
  }

  if (path === "/") updateSystemStatus(true, null);
  if (path === "/dashboard") updateSystemStatus(true, true);
  return data;
}

// ============================================================
//  TOAST
// ============================================================
function toast(msg, type = "success") {
  const icons = { success:"fa-circle-check", error:"fa-circle-xmark", warning:"fa-triangle-exclamation" };
  const iconEl = document.getElementById("toast-icon");
  const msgEl  = document.getElementById("toast-msg");
  if (!iconEl || !msgEl) return;
  iconEl.className = `tst-ico ${type}`;
  iconEl.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i>`;
  msgEl.textContent = msg;
  const t = document.getElementById("toast");
  // Warna border kiri sesuai tipe
  const colors = { success:"var(--gr1)", error:"var(--re)", warning:"var(--ye)" };
  t.style.borderLeftColor = colors[type] || colors.success;
  t.style.borderLeftWidth = "3px";
  t.style.borderLeftStyle = "solid";
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3500);
}

// ============================================================
//  MODAL
// ============================================================
function showModal(id)  { const el = document.getElementById(id); if (el) el.classList.add("open"); }
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // Animasi keluar modal sebelum disembunyikan
  const modal = el.querySelector(".modal");
  if (modal) {
    modal.style.animation = "mOut .18s ease forwards";
    modal.style.setProperty("--mOut-anim", "");
    setTimeout(() => {
      el.classList.remove("open");
      modal.style.animation = "";
    }, 170);
  } else {
    el.classList.remove("open");
  }
}
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }
function resetForm(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelectorAll("input").forEach(i => i.value = "");
  el.querySelectorAll("select").forEach(s => s.selectedIndex = 0);
}

// ── Ripple effect untuk semua tombol ──
document.addEventListener("click", e => {
  const btn = e.target.closest(".abt, .btn-add, .btn-save, .btn-cancel, .btn-export, .nav-sosmed-btn, .dark-toggle");
  if (!btn) return;
  const r    = document.createElement("span");
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.className = "ripple";
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(r);
  r.addEventListener("animationend", () => r.remove());
});

// ============================================================
//  LOADING STATE
// ============================================================
function setLoad(btn, on) {
  if (!btn) return;
  if (on)  { btn._h = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }
  else     { if (btn._h) btn.innerHTML = btn._h; btn.disabled = false; }
}

// ============================================================
//  HELPER ROWS
// ============================================================
function loadingRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--tx3)">
    <i class="fa-solid fa-spinner fa-spin" style="font-size:1.1rem;display:block;margin-bottom:7px"></i>
    <span style="font-size:.79rem">Memuat data...</span></td></tr>`;
}
function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--re);font-size:.79rem">
    <i class="fa-solid fa-circle-xmark" style="font-size:1.2rem;display:block;margin-bottom:7px"></i>${msg}</td></tr>`;
}
function emptyRow(cols, icon, title, sub) {
  return `<tr class="empty-row"><td colspan="${cols}">
    <div class="emst"><div class="emst-ico"><i class="fa-solid ${icon}"></i></div>
    <p>${title}</p><span>${sub}</span></div></td></tr>`;
}

const C = { h:"var(--tx1)", b:"var(--tx2)", f:"var(--tx3)" };

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const d = await api("GET", "/dashboard");
    animateCounter("dash-total-sampah", d.sampah.total);
    animateCounter("dash-belum",        d.sampah.belum_diambil);
    animateCounter("dash-sudah",        d.sampah.sudah_diambil);
    animateCounter("dash-berat",        d.sampah.total_berat_kg.toFixed(1));
    set("dash-petugas",      `${d.petugas.aktif}/${d.petugas.total}`);
    animateCounter("dash-servis",       d.kendaraan.servis);

    const total = d.sampah.total || 1;
    const pS = Math.round((d.sampah.sudah_diambil / total) * 100);
    const pB = Math.round((d.sampah.belum_diambil / total) * 100);
    const pP = d.petugas.total > 0 ? Math.round((d.petugas.aktif / d.petugas.total) * 100) : 0;

    barW("bar-sudah", pS); barW("bar-belum", pB); barW("bar-petugas", pP);
    barW("bar-servis", d.kendaraan.servis > 0 ? 100 : 0);
    set("pct-sampah",    pS + "%");
    set("pct-petugas-d", pP + "%");
  } catch (err) { toast(err.message, "error"); }

  // Load chart statistik
  try {
    const s = await api("GET", "/statistik");
    renderCharts(s);
  } catch {}

  // Load mini chart preview harian (background, jangan block)
  loadHarian().catch(() => {});

  // Load quick action panel
  loadQuickAction();
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function barW(id, pct) { const el = document.getElementById(id); if (el) el.style.width = pct + "%"; }

// ── Refresh angka dashboard di background tanpa pindah halaman ──
async function refreshStats() {
  try {
    const d = await api("GET", "/dashboard");
    animateCounter("dash-total-sampah", d.sampah.total);
    animateCounter("dash-belum",        d.sampah.belum_diambil);
    animateCounter("dash-sudah",        d.sampah.sudah_diambil);
    animateCounter("dash-berat",        d.sampah.total_berat_kg.toFixed(1));
    set("dash-petugas", `${d.petugas.aktif}/${d.petugas.total}`);
    animateCounter("dash-servis", d.kendaraan.servis);
    const total = d.sampah.total || 1;
    const pS = Math.round((d.sampah.sudah_diambil / total) * 100);
    const pB = Math.round((d.sampah.belum_diambil / total) * 100);
    const pP = d.petugas.total > 0 ? Math.round((d.petugas.aktif / d.petugas.total) * 100) : 0;
    barW("bar-sudah", pS); barW("bar-belum", pB); barW("bar-petugas", pP);
    barW("bar-servis", d.kendaraan.servis > 0 ? 100 : 0);
    set("pct-sampah",    pS + "%");
    set("pct-petugas-d", pP + "%");
  } catch {} // silent — jangan ganggu halaman aktif
}

// Animasi counter angka KPI
function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const num = parseFloat(target);
  if (isNaN(num)) { el.textContent = target; return; }
  const duration = 600;
  const start    = performance.now();
  const from     = parseFloat(el.textContent) || 0;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current  = from + (num - from) * ease;
    // Format sesuai target
    el.textContent = Number.isInteger(num)
      ? Math.round(current).toString()
      : current.toFixed(1);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

// ============================================================
//  3. CHART RENDERING
// ============================================================
function renderCharts(s) {
  // ── Donut chart: jenis sampah ──
  const organik   = s.jenis["Organik"]   || 0;
  const anorganik = s.jenis["Anorganik"] || 0;
  const b3        = s.jenis["B3"]        || 0;
  const totalJ    = organik + anorganik + b3 || 1;
  const circ      = 2 * Math.PI * 35; // ~220

  set("chart-organik",   organik);
  set("chart-anorganik", anorganik);
  set("chart-b3",        b3);

  // Hitung dash offset per segment (stacked donut)
  const dOrg  = (organik   / totalJ) * circ;
  const dAnorg = (anorganik / totalJ) * circ;
  const dB3   = (b3        / totalJ) * circ;

  const elOrg   = document.getElementById("donut-organik");
  const elAnorg = document.getElementById("donut-anorganik");
  const elB3    = document.getElementById("donut-b3");

  if (elOrg)   { elOrg.setAttribute("stroke-dasharray",   `${dOrg.toFixed(1)} ${circ}`); elOrg.setAttribute("stroke-dashoffset", "55"); }
  if (elAnorg) {
    const offsetAnorg = 55 - dOrg;
    elAnorg.setAttribute("stroke-dasharray", `${dAnorg.toFixed(1)} ${circ}`);
    elAnorg.setAttribute("stroke-dashoffset", offsetAnorg.toFixed(1));
  }
  if (elB3) {
    const offsetB3 = 55 - dOrg - dAnorg;
    elB3.setAttribute("stroke-dasharray", `${dB3.toFixed(1)} ${circ}`);
    elB3.setAttribute("stroke-dashoffset", offsetB3.toFixed(1));
  }

  // ── Bar chart: berat per jenis ──
  const bOrg   = s.total_berat_per_jenis["Organik"]   || 0;
  const bAnorg = s.total_berat_per_jenis["Anorganik"] || 0;
  const bB3    = s.total_berat_per_jenis["B3"]        || 0;
  const maxB   = Math.max(bOrg, bAnorg, bB3, 1);

  set("berat-organik",   bOrg);
  set("berat-anorganik", bAnorg);
  set("berat-b3",        bB3);

  const bbOrg   = document.getElementById("bbar-organik");
  const bbAnorg = document.getElementById("bbar-anorganik");
  const bbB3    = document.getElementById("bbar-b3");
  if (bbOrg)   bbOrg.style.width   = ((bOrg   / maxB) * 100).toFixed(0) + "%";
  if (bbAnorg) bbAnorg.style.width = ((bAnorg / maxB) * 100).toFixed(0) + "%";
  if (bbB3)    bbB3.style.width    = ((bB3    / maxB) * 100).toFixed(0) + "%";

  // ── Top lokasi ──
  const topBox = document.getElementById("top-lokasi-chart");
  if (topBox && s.top_lokasi && s.top_lokasi.length > 0) {
    const maxL = s.top_lokasi[0].jumlah || 1;
    topBox.innerHTML = s.top_lokasi.map(l => `
      <div class="bc-item">
        <div class="bc-label">
          <span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.lokasi}">${l.lokasi}</span>
          <b>${l.jumlah}</b>
        </div>
        <div class="bc-track"><div class="bc-fill" style="width:${((l.jumlah/maxL)*100).toFixed(0)}%;background:linear-gradient(90deg,var(--gr1),var(--te1))"></div></div>
      </div>`).join("");
  } else if (topBox) {
    topBox.innerHTML = `<div style="text-align:center;padding:16px;color:var(--tx3);font-size:.79rem">Belum ada data lokasi</div>`;
  }
}

// ============================================================
//  SAMPAH — dengan search & filter
// ============================================================
async function loadSampah() {
  const tbody = document.getElementById("tabel-sampah");
  const cnt   = document.getElementById("count-sampah");
  if (!tbody) return;
  tbody.innerHTML = loadingRow(7);
  try {
    _sampahData = await api("GET", "/sampah");
    renderSampah();
  } catch (err) { tbody.innerHTML = errorRow(7, err.message); toast(err.message, "error"); }
}

function renderSampah() {
  const tbody  = document.getElementById("tabel-sampah");
  const cnt    = document.getElementById("count-sampah");
  const q      = (document.getElementById("search-sampah")?.value || "").toLowerCase();
  const fJenis = document.getElementById("filter-sampah-jenis")?.value || "";
  const fStatus= document.getElementById("filter-sampah-status")?.value || "";

  let list = _sampahData.filter(s => {
    const matchQ = !q || s.lokasi.toLowerCase().includes(q) || s.jenis.toLowerCase().includes(q);
    const matchJ = !fJenis  || s.jenis === fJenis;
    const matchS = !fStatus ||
      (fStatus === "sudah" && s.sudah_diambil) ||
      (fStatus === "belum" && !s.sudah_diambil);
    return matchQ && matchJ && matchS;
  });

  if (cnt) cnt.textContent = `${list.length} item`;
  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML = emptyRow(7, "fa-trash-can", "Tidak ada data ditemukan", "Coba ubah filter atau tambah data baru");
    return;
  }

  list.forEach(s => {
    const bc  = { TINGGI:"badge-red", SEDANG:"badge-orange", RENDAH:"badge-green" }[s.tingkat_bahaya] || "badge-gray";
    const bi  = { TINGGI:"🔴", SEDANG:"🟡", RENDAH:"🟢" }[s.tingkat_bahaya] || "";
    const sb  = s.sudah_diambil
      ? `<span class="badge badge-green"><i class="fa-solid fa-check"></i> Sudah</span>`
      : `<span class="badge badge-orange"><i class="fa-solid fa-clock"></i> Belum</span>`;
    const amb = !s.sudah_diambil
      ? `<button class="abt in" onclick="ambilSampah(${s.id})"><i class="fa-solid fa-check"></i> Ambil</button>` : "";
    tbody.innerHTML += `<tr>
      <td><b style="color:${C.f}">#${s.id}</b></td>
      <td><b style="color:${C.h}">${s.jenis}</b></td>
      <td><b style="color:${C.h}">${s.berat_kg}</b> <span style="color:${C.f};font-size:.72rem">kg</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.lokasi}">${s.lokasi}</td>
      <td><span class="badge ${bc}">${bi} ${s.tingkat_bahaya}</span></td>
      <td>${sb}</td>
      <td><div class="abt-g">
        ${amb}
        <button class="abt ed" onclick="bukaEditSampah(${s.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="abt da" onclick="hapusSampah(${s.id})"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  });
}

// Search & filter event listeners
["search-sampah","filter-sampah-jenis","filter-sampah-status"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", renderSampah);
});

async function tambahSampah() {
  const jenis  = document.getElementById("inp-sampah-jenis").value;
  const berat  = parseFloat(document.getElementById("inp-sampah-berat").value);
  const lokasi = document.getElementById("inp-sampah-lokasi").value.trim();
  if (!lokasi)                    { toast("Lokasi tidak boleh kosong!", "error"); return; }
  if (isNaN(berat) || berat <= 0) { toast("Berat harus lebih dari 0!", "error"); return; }
  const btn = document.querySelector("#modal-sampah .btn-save");
  setLoad(btn, true);
  try {
    await api("POST", "/sampah", { jenis, berat_kg: berat, lokasi });
    closeModal("modal-sampah"); resetForm("modal-sampah");
    toast(`Sampah ${jenis} (${berat} kg) ditambahkan!`);
    loadSampah(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

async function ambilSampah(id) {
  try {
    await api("PATCH", `/sampah/${id}/ambil`);
    toast(`Sampah #${id} ditandai sudah diambil`);
    const row = [...document.querySelectorAll("#tabel-sampah tr")].find(r => r.innerHTML.includes(`#${id}`));
    if (row) { row.classList.add("row-updated"); await new Promise(r => setTimeout(r, 300)); }
    loadSampah();
    refreshStats();

    // ── WORKFLOW: tawarkan muat ke kendaraan ──
    setTimeout(async () => {
      try {
        const kList = await api("GET", "/kendaraan");
        const aktif = kList.filter(k => k.kondisi !== "Servis");
        if (!aktif.length) {
          showWorkflow({
            icon: "fa-circle-check",
            title: "Sampah berhasil diambil!",
            desc: "Tidak ada kendaraan yang tersedia saat ini.",
            actions: [{
              label: "Tambah Kendaraan",
              color: "blue", icon: "fa-truck",
              fn: () => { closeWorkflow(); document.querySelector('.nav-link[data-page="kendaraan"]')?.click(); setTimeout(() => showModal("modal-kendaraan"), 300); }
            }],
            secondary: null
          });
          return;
        }
        showWorkflow({
          icon: "fa-circle-check",
          title: "Sampah berhasil diambil!",
          desc: "Muat langsung ke kendaraan yang tersedia:",
          actions: aktif.slice(0, 3).map(k => {
            const pct = k.kapasitas_kg > 0 ? Math.round((k.muatan_kg / k.kapasitas_kg) * 100) : 0;
            return {
              label: `${k.plat_nomor} (${pct}% penuh)`,
              color: pct >= 90 ? "red" : "green",
              icon: "fa-truck",
              fn: () => { closeWorkflow(); muatLangsungKeSampah(k.id, k.plat_nomor, id); }
            };
          }),
          secondary: { label: "Ke halaman Kendaraan", fn: () => { closeWorkflow(); document.querySelector('.nav-link[data-page="kendaraan"]')?.click(); } }
        });
      } catch {}
    }, 400);
  } catch (err) { toast(err.message, "error"); }
}

// Muat sampah langsung ke kendaraan (dari workflow)
let _workflowSampahId = null;
async function muatLangsungKeSampah(kendaraanId, platNomor, sampahId) {
  try {
    await api("PATCH", `/kendaraan/${kendaraanId}/muat/${sampahId}`);
    toast(`✓ Sampah dimuat ke ${platNomor}`);
    loadKendaraan();
    refreshStats();
  } catch (err) { toast(err.message, "error"); }
}

async function hapusSampah(id) {
  if (!confirm(`Hapus sampah #${id}?`)) return;
  // Animasi row hilang dulu baru hapus
  const row = document.querySelector(`#tabel-sampah tr[data-id="${id}"]`)
           || [...document.querySelectorAll("#tabel-sampah tr")].find(r => r.innerHTML.includes(`#${id}`));
  if (row) {
    row.classList.add("row-removing");
    await new Promise(r => setTimeout(r, 240));
  }
  try {
    await api("DELETE", `/sampah/${id}`);
    toast(`Sampah #${id} dihapus`);
    loadSampah(); refreshStats();
  } catch (err) { toast(err.message, "error"); if (row) row.classList.remove("row-removing"); }
}

// ── 4. EDIT SAMPAH ──
function bukaEditSampah(id) {
  const s = _sampahData.find(x => x.id === id);
  if (!s) return;
  document.getElementById("edit-sampah-id").value    = s.id;
  document.getElementById("edit-sampah-jenis").value = s.jenis;
  document.getElementById("edit-sampah-berat").value = s.berat_kg;
  document.getElementById("edit-sampah-lokasi").value= s.lokasi;
  showModal("modal-edit-sampah");
}

async function simpanEditSampah() {
  const id     = parseInt(document.getElementById("edit-sampah-id").value);
  const jenis  = document.getElementById("edit-sampah-jenis").value;
  const berat  = parseFloat(document.getElementById("edit-sampah-berat").value);
  const lokasi = document.getElementById("edit-sampah-lokasi").value.trim();
  if (!lokasi)                    { toast("Lokasi tidak boleh kosong!", "error"); return; }
  if (isNaN(berat) || berat <= 0) { toast("Berat harus lebih dari 0!", "error"); return; }
  const btn = document.querySelector("#modal-edit-sampah .btn-save");
  setLoad(btn, true);
  try {
    await api("PUT", `/sampah/${id}`, { jenis, berat_kg: berat, lokasi });
    closeModal("modal-edit-sampah");
    toast(`Sampah #${id} berhasil diperbarui!`);
    loadSampah(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

// ============================================================
//  5. EXPORT CSV
// ============================================================
function exportCSV(type) {
  const url = `${API}/export/${type}`;
  const a   = document.createElement("a");
  a.href    = url;
  a.download= type === "sampah" ? "data-sampah.csv" : "laporan-harian.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast(`Export ${type} CSV berhasil!`);
}

// ============================================================
//  PETUGAS — dengan search
// ============================================================
async function loadPetugas() {
  const tbody = document.getElementById("tabel-petugas");
  const cnt   = document.getElementById("count-petugas");
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);
  try {
    _petugasData = await api("GET", "/petugas");
    renderPetugas();
  } catch (err) { tbody.innerHTML = errorRow(6, err.message); toast(err.message, "error"); }
}

function renderPetugas() {
  const tbody = document.getElementById("tabel-petugas");
  const cnt   = document.getElementById("count-petugas");
  const q     = (document.getElementById("search-petugas")?.value || "").toLowerCase();

  const list = _petugasData.filter(p =>
    !q || p.nama.toLowerCase().includes(q) || p.zona_tugas.toLowerCase().includes(q)
  );

  if (cnt) cnt.textContent = `${list.length} petugas`;
  tbody.innerHTML = "";
  if (!list.length) { tbody.innerHTML = emptyRow(6,"fa-users","Tidak ada data ditemukan","Coba ubah kata kunci pencarian"); return; }

  list.forEach(p => {
    const sb = p.status_aktif
      ? `<span class="badge badge-green"><i class="fa-solid fa-circle" style="font-size:.43rem"></i> Aktif</span>`
      : `<span class="badge badge-red"><i class="fa-solid fa-circle" style="font-size:.43rem"></i> Nonaktif</span>`;
    const tb = p.status_aktif
      ? `<button class="abt wa" onclick="togglePetugas(${p.id},false)"><i class="fa-solid fa-ban"></i> Nonaktifkan</button>`
      : `<button class="abt su" onclick="togglePetugas(${p.id},true)"><i class="fa-solid fa-check"></i> Aktifkan</button>`;
    tbody.innerHTML += `<tr>
      <td><b style="color:${C.f}">#${p.id}</b></td>
      <td>
        <div style="font-weight:700;color:${C.h}">${p.nama}</div>
        <div style="font-size:.72rem;color:${C.f};margin-top:1px">${p.zona_tugas}</div>
      </td>
      <td style="color:${C.b}">${p.zona_tugas}</td>
      <td>
        <span class="badge badge-blue" style="font-size:.7rem">
          <i class="fa-solid fa-check" style="font-size:.55rem"></i> ${p.total_ambil} item
        </span>
      </td>
      <td>${sb}</td>
      <td>
        <div class="abt-g">
          <button class="abt pr" onclick="bukaTugaskanSampah(${p.id},'${p.nama.replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-person-digging"></i> Tugaskan
          </button>
          <button class="abt ed" onclick="bukaEditPetugas(${p.id},'${p.nama.replace(/'/g,"\\'")}','${p.zona_tugas.replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          ${tb}
          <button class="abt da" onclick="hapusPetugas(${p.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  });
}

const spEl = document.getElementById("search-petugas");
if (spEl) spEl.addEventListener("input", renderPetugas);

async function tambahPetugas() {
  const nama = document.getElementById("inp-petugas-nama").value.trim();
  const zona = document.getElementById("inp-petugas-zona").value.trim();
  if (!nama) { toast("Nama tidak boleh kosong!", "error"); return; }
  if (!zona) { toast("Zona tugas tidak boleh kosong!", "error"); return; }
  const btn = document.querySelector("#modal-petugas .btn-save");
  setLoad(btn, true);
  try {
    await api("POST", "/petugas", { nama, zona_tugas: zona });
    closeModal("modal-petugas"); resetForm("modal-petugas");
    toast(`Petugas ${nama} ditambahkan!`);
    loadPetugas(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

// ── Tugaskan petugas ambil sampah ──
let _tugaskanPetugasId = null;

async function bukaTugaskanSampah(petugasId, petugasNama) {
  _tugaskanPetugasId = petugasId;

  const infoEl = document.getElementById("tugaskan-petugas-info");
  if (infoEl) infoEl.textContent = `Petugas: ${petugasNama} — pilih sampah yang akan ditugaskan.`;

  const select = document.getElementById("inp-tugaskan-sampah-id");
  if (!select) return;

  select.innerHTML = `<option value="">Memuat data...</option>`;
  showModal("modal-tugaskan-petugas");

  try {
    const list  = await api("GET", "/sampah");
    const belum = list.filter(s => !s.sudah_diambil);

    if (belum.length === 0) {
      select.innerHTML = `<option value="">Tidak ada sampah yang perlu diambil</option>`;
      toast("Semua sampah sudah diambil!", "warning");
      return;
    }

    select.innerHTML = `<option value="">-- Pilih sampah --</option>` +
      belum.map(s => {
        const bahayaLabel = { TINGGI:"🔴", SEDANG:"🟡", RENDAH:"🟢" }[s.tingkat_bahaya] || "";
        return `<option value="${s.id}"
          data-berat="${s.berat_kg}"
          data-jenis="${s.jenis}"
          data-lokasi="${s.lokasi}"
          data-bahaya="${s.tingkat_bahaya}">
          #${s.id} — ${bahayaLabel} ${s.jenis} | ${s.berat_kg} kg | ${s.lokasi}
        </option>`;
      }).join("");

    select.onchange = () => {
      const opt    = select.options[select.selectedIndex];
      const detail = document.getElementById("tugaskan-sampah-detail");
      if (!detail) return;
      if (!opt.value) { detail.style.display = "none"; return; }
      const warna = opt.dataset.bahaya === "TINGGI" ? "#ef4444"
                  : opt.dataset.bahaya === "SEDANG"  ? "#f59e0b" : "#10b981";
      detail.style.display = "block";
      detail.innerHTML = `
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
          <span><b>Jenis:</b> ${opt.dataset.jenis}</span>
          <span><b>Berat:</b> ${opt.dataset.berat} kg</span>
          <span><b>Lokasi:</b> ${opt.dataset.lokasi}</span>
          <span style="color:${warna};font-weight:700">
            ● Bahaya: ${opt.dataset.bahaya}
          </span>
        </div>`;
    };

  } catch (err) {
    select.innerHTML = `<option value="">Gagal memuat data</option>`;
    toast(err.message, "error");
  }
}

async function simpanTugaskanSampah() {
  const sampahId = parseInt(document.getElementById("inp-tugaskan-sampah-id").value);
  if (!sampahId || isNaN(sampahId)) { toast("Pilih sampah terlebih dahulu!", "error"); return; }

  const btn = document.getElementById("btn-tugaskan-petugas");
  setLoad(btn, true);
  try {
    const r = await api("PATCH", `/petugas/${_tugaskanPetugasId}/kumpulkan/${sampahId}`);
    closeModal("modal-tugaskan-petugas");
    toast(r.pesan || `Sampah berhasil ditugaskan dan diambil oleh petugas`);
    loadPetugas();
    loadSampah();
    refreshStats();

    // ── WORKFLOW: tawarkan muat ke kendaraan ──
    setTimeout(async () => {
      try {
        const kList = await api("GET", "/kendaraan");
        const aktif = kList.filter(k => k.kondisi !== "Servis");
        if (!aktif.length) return;
        showWorkflow({
          icon: "fa-person-digging",
          title: "Petugas berhasil mengambil sampah!",
          desc: "Muat sampah ke kendaraan sekarang?",
          actions: aktif.slice(0, 3).map(k => ({
            label: `Muat ke ${k.plat_nomor}`,
            color: "green", icon: "fa-truck",
            fn: () => { closeWorkflow(); muatLangsungKeSampah(k.id, k.plat_nomor, sampahId); }
          })),
          secondary: { label: "Nanti saja", fn: () => closeWorkflow() }
        });
      } catch {}
    }, 400);
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

// ── Edit petugas ──
function bukaEditPetugas(id, nama, zona) {
  document.getElementById("edit-petugas-id").value   = id;
  document.getElementById("edit-petugas-nama").value = nama;
  document.getElementById("edit-petugas-zona").value = zona;
  showModal("modal-edit-petugas");
}

async function simpanEditPetugas() {
  const id   = parseInt(document.getElementById("edit-petugas-id").value);
  const nama = document.getElementById("edit-petugas-nama").value.trim();
  const zona = document.getElementById("edit-petugas-zona").value.trim();

  if (!nama) { toast("Nama tidak boleh kosong!", "error"); return; }
  if (!zona) { toast("Zona tugas tidak boleh kosong!", "error"); return; }

  const btn = document.querySelector("#modal-edit-petugas .btn-save");
  setLoad(btn, true);
  try {
    // Endpoint edit petugas — PATCH nama dan zona
    await api("PATCH", `/petugas/${id}/edit`, { nama, zona_tugas: zona });
    closeModal("modal-edit-petugas");
    toast(`Data petugas berhasil diperbarui!`);
    loadPetugas();
  } catch (err) {
    // Fallback: hapus lama, buat baru dengan data terupdate (jika endpoint edit belum ada)
    if (err.message.includes("404") || err.message.includes("Not Found") || err.message.includes("Method")) {
      toast("Fitur edit belum didukung backend. Silakan hapus dan tambah ulang.", "warning");
    } else {
      toast(err.message, "error");
    }
  }
  finally { setLoad(btn, false); }
}

async function togglePetugas(id, aktifkan) {
  try {
    const r = await api("PATCH", `/petugas/${id}/${aktifkan ? "aktifkan" : "nonaktifkan"}`);
    toast(r.pesan || (aktifkan ? "Petugas diaktifkan" : "Petugas dinonaktifkan"));
    const row = [...document.querySelectorAll("#tabel-petugas tr")].find(r => r.innerHTML.includes(`#${id}`));
    if (row) { row.classList.add("row-updated"); await new Promise(r => setTimeout(r, 300)); }
    loadPetugas(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
}

async function hapusPetugas(id) {
  if (!confirm(`Hapus petugas #${id}?`)) return;
  const row = [...document.querySelectorAll("#tabel-petugas tr")].find(r => r.innerHTML.includes(`#${id}`));
  if (row) { row.classList.add("row-removing"); await new Promise(r => setTimeout(r, 240)); }
  try {
    await api("DELETE", `/petugas/${id}`);
    toast(`Petugas #${id} dihapus`);
    loadPetugas(); refreshStats();
  } catch (err) { toast(err.message, "error"); if (row) row.classList.remove("row-removing"); }
}

// ============================================================
//  KENDARAAN — dengan search
// ============================================================
async function loadKendaraan() {
  const tbody = document.getElementById("tabel-kendaraan");
  const cnt   = document.getElementById("count-kendaraan");
  if (!tbody) return;
  tbody.innerHTML = loadingRow(7);
  try {
    _kendaraanData = await api("GET", "/kendaraan");
    renderKendaraan();
  } catch (err) { tbody.innerHTML = errorRow(7, err.message); toast(err.message, "error"); }
}

function renderKendaraan() {
  const tbody = document.getElementById("tabel-kendaraan");
  const cnt   = document.getElementById("count-kendaraan");
  const q     = (document.getElementById("search-kendaraan")?.value || "").toLowerCase();

  const list = _kendaraanData.filter(k =>
    !q || k.plat_nomor.toLowerCase().includes(q) || (k.rute || "").toLowerCase().includes(q)
  );

  if (cnt) cnt.textContent = `${list.length} unit`;
  tbody.innerHTML = "";
  if (!list.length) { tbody.innerHTML = emptyRow(7,"fa-truck","Tidak ada data ditemukan","Coba ubah kata kunci pencarian"); return; }

  list.forEach(k => {
    const kb  = k.kondisi === "Servis"
      ? `<span class="badge badge-red"><i class="fa-solid fa-wrench"></i> Servis</span>`
      : `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Baik</span>`;
    const pct = k.kapasitas_kg > 0 ? (k.muatan_kg / k.kapasitas_kg) * 100 : 0;
    const bc  = pct >= 90 ? "full" : pct >= 60 ? "warn" : "";
    const svs = k.kondisi !== "Servis"
      ? `<button class="abt wa" onclick="servisKendaraan(${k.id})"><i class="fa-solid fa-wrench"></i></button>` : "";
    tbody.innerHTML += `<tr>
      <td><b style="color:${C.f}">#${k.id}</b></td>
      <td><b style="color:${C.h}">${k.plat_nomor}</b></td>
      <td style="color:${C.b}">${k.kapasitas_kg.toLocaleString()} kg</td>
      <td style="min-width:130px">
        <div style="display:flex;align-items:center;gap:5px">
          <b style="color:${C.h}">${k.muatan_kg}</b>
          <span style="color:${C.f};font-size:.72rem">/ ${k.kapasitas_kg} kg</span>
        </div>
        <div class="bar-wrap"><div class="bar-fill ${bc}" style="width:${pct.toFixed(0)}%"></div></div>
      </td>
      <td>${kb}</td>
      <td style="font-size:.76rem;color:${C.b};max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${k.rute || "–"}</td>
      <td><div class="abt-g">
        <button class="abt pr" onclick="bukaMuatSampah(${k.id},'${k.plat_nomor}')">
          <i class="fa-solid fa-plus"></i> Muat
        </button>
        <button class="abt in" onclick="bongkarKendaraan(${k.id})"><i class="fa-solid fa-box-open"></i> Bongkar</button>
        ${svs}
        <button class="abt da" onclick="hapusKendaraan(${k.id})"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  });
}

const skEl = document.getElementById("search-kendaraan");
if (skEl) skEl.addEventListener("input", renderKendaraan);

async function tambahKendaraan() {
  const plat = document.getElementById("inp-kendaraan-plat").value.trim();
  const kap  = parseFloat(document.getElementById("inp-kendaraan-kapasitas").value);
  if (!plat)                   { toast("Plat nomor tidak boleh kosong!", "error"); return; }
  if (isNaN(kap) || kap <= 0) { toast("Kapasitas harus lebih dari 0!", "error"); return; }
  const btn = document.querySelector("#modal-kendaraan .btn-save");
  setLoad(btn, true);
  try {
    await api("POST", "/kendaraan", { plat_nomor: plat, kapasitas_kg: kap });
    closeModal("modal-kendaraan"); resetForm("modal-kendaraan");
    toast(`Kendaraan ${plat} ditambahkan!`);
    loadKendaraan(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

// ── Muat sampah ke kendaraan ──
let _currentKendaraanId = null;

async function bukaMuatSampah(kendaraanId, platNomor) {
  _currentKendaraanId = kendaraanId;

  const infoEl = document.getElementById("muat-kendaraan-info");
  if (infoEl) infoEl.textContent = `Kendaraan: ${platNomor} — pilih sampah yang akan dimuat.`;

  const select = document.getElementById("inp-muat-sampah-id");
  if (!select) return;

  select.innerHTML = `<option value="">Memuat data...</option>`;
  showModal("modal-muat-kendaraan");

  try {
    const list  = await api("GET", "/sampah");
    const belum = list.filter(s => !s.sudah_diambil);

    if (belum.length === 0) {
      select.innerHTML = `<option value="">Tidak ada sampah yang belum diambil</option>`;
      toast("Semua sampah sudah diambil. Tambah sampah baru dulu!", "warning");
      return;
    }

    select.innerHTML = `<option value="">-- Pilih sampah --</option>` +
      belum.map(s =>
        `<option value="${s.id}" data-berat="${s.berat_kg}" data-jenis="${s.jenis}" data-lokasi="${s.lokasi}">
          #${s.id} — ${s.jenis} | ${s.berat_kg} kg | ${s.lokasi}
        </option>`
      ).join("");

    select.onchange = () => {
      const opt    = select.options[select.selectedIndex];
      const detail = document.getElementById("muat-sampah-detail");
      if (!detail) return;
      if (!opt.value) { detail.style.display = "none"; return; }
      detail.style.display = "block";
      detail.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <span><b>Jenis:</b> ${opt.dataset.jenis}</span>
          <span><b>Berat:</b> ${opt.dataset.berat} kg</span>
          <span><b>Lokasi:</b> ${opt.dataset.lokasi}</span>
        </div>`;
    };

  } catch (err) {
    select.innerHTML = `<option value="">Gagal memuat data</option>`;
    toast(err.message, "error");
  }
}

async function simpanMuatSampah() {
  const sampahId = parseInt(document.getElementById("inp-muat-sampah-id").value);
  if (!sampahId || isNaN(sampahId)) { toast("Pilih sampah terlebih dahulu!", "error"); return; }

  const btn = document.getElementById("btn-muat-kendaraan");
  setLoad(btn, true);
  try {
    const r = await api("PATCH", `/kendaraan/${_currentKendaraanId}/muat/${sampahId}`);
    closeModal("modal-muat-kendaraan");
    toast(r.pesan || `Sampah berhasil dimuat ke kendaraan`);
    loadKendaraan();
    refreshStats();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

async function bongkarKendaraan(id) {
  if (!confirm(`Bongkar muatan kendaraan #${id}?`)) return;
  try {
    const r = await api("PATCH", `/kendaraan/${id}/bongkar`);
    toast(r.pesan || "Muatan berhasil dibongkar");
    const row = [...document.querySelectorAll("#tabel-kendaraan tr")].find(r => r.innerHTML.includes(`#${id}`));
    if (row) { row.classList.add("row-updated"); await new Promise(r => setTimeout(r, 300)); }
    loadKendaraan();
    refreshStats();

    // ── WORKFLOW: tawarkan terima sampah ke TPA setelah bongkar ──
    setTimeout(async () => {
      try {
        const tpaList = await api("GET", "/tpa");
        if (tpaList.length === 0) return;
        showWorkflow({
          icon: "fa-industry",
          title: "Muatan sudah dibongkar!",
          desc: "Apakah sampah ini ingin langsung dimasukkan ke TPA?",
          actions: tpaList.slice(0, 3).map(t => ({
            label: `Kirim ke ${t.nama}`,
            color: "green",
            icon: "fa-truck-arrow-right",
            fn: () => bukaTerimaKeTPA(t.id, t.nama)
          })),
          secondary: { label: "Buat Laporan Sekarang", fn: () => { closeWorkflow(); document.querySelector('.nav-link[data-page="laporan"]')?.click(); } }
        });
      } catch {}
    }, 400);
  } catch (err) { toast(err.message, "error"); }
}

async function servisKendaraan(id) {
  if (!confirm(`Kirim kendaraan #${id} ke servis?`)) return;
  try {
    const r = await api("PATCH", `/kendaraan/${id}/servis`);
    toast(r.pesan || "Kendaraan dikirim ke servis");
    loadKendaraan(); refreshStats();
  } catch (err) { toast(err.message, "error"); }
}

async function hapusKendaraan(id) {
  if (!confirm(`Hapus kendaraan #${id}?`)) return;
  const row = [...document.querySelectorAll("#tabel-kendaraan tr")].find(r => r.innerHTML.includes(`#${id}`));
  if (row) { row.classList.add("row-removing"); await new Promise(r => setTimeout(r, 240)); }
  try {
    await api("DELETE", `/kendaraan/${id}`);
    toast(`Kendaraan #${id} dihapus`);
    loadKendaraan(); refreshStats();
  } catch (err) { toast(err.message, "error"); if (row) row.classList.remove("row-removing"); }
}

// ============================================================
//  TPA
// ============================================================
async function loadTPA() {
  const tbody = document.getElementById("tabel-tpa");
  const cnt   = document.getElementById("count-tpa");
  if (!tbody) return;
  tbody.innerHTML = loadingRow(7);
  try {
    const list = await api("GET", "/tpa");
    if (cnt) cnt.textContent = `${list.length} lokasi`;
    tbody.innerHTML = "";
    if (!list.length) { tbody.innerHTML = emptyRow(7,"fa-industry","Belum ada TPA","Klik \"Tambah TPA\" untuk mulai"); return; }
    list.forEach(t => {
      const pct = t.kapasitas_ton > 0 ? (t.terisi_ton / t.kapasitas_ton) * 100 : 0;
      const bc  = pct >= 90 ? "full" : pct >= 60 ? "warn" : "";
      const pb  = pct >= 90 ? "badge-red" : pct >= 60 ? "badge-orange" : "badge-green";
      // Warna kondisi
      const kondisi = pct >= 90 ? `<span class="badge badge-red"><i class="fa-solid fa-triangle-exclamation"></i> Kritis</span>`
                    : pct >= 60 ? `<span class="badge badge-orange"><i class="fa-solid fa-circle-exclamation"></i> Hampir Penuh</span>`
                    : `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Normal</span>`;
      tbody.innerHTML += `<tr>
        <td><b style="color:${C.f}">#${t.id}</b></td>
        <td><b style="color:${C.h}">${t.nama}</b></td>
        <td style="color:${C.b}">${t.kapasitas_ton.toLocaleString()} ton</td>
        <td style="color:${C.b}">${t.terisi_ton.toFixed(3)} ton</td>
        <td style="min-width:160px">
          ${kondisi}
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
            <div class="bar-wrap" style="flex:1;margin-top:0"><div class="bar-fill ${bc}" style="width:${pct.toFixed(0)}%"></div></div>
            <span style="font-size:.72rem;font-weight:700;color:${C.b};min-width:36px">${pct.toFixed(1)}%</span>
          </div>
        </td>
        <td style="color:${C.b};font-size:.77rem">${t.tgl_terakhir_dikosongkan}</td>
        <td><div class="abt-g">
          <button class="abt pr" onclick="bukaTerimaSampah(${t.id},'${t.nama}')">
            <i class="fa-solid fa-truck-arrow-right"></i> Terima
          </button>
          <button class="abt wa" onclick="kosongkanTPA(${t.id})">
            <i class="fa-solid fa-broom"></i> Kosongkan
          </button>
          <button class="abt da" onclick="hapusTPA(${t.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div></td>
      </tr>`;
    });
  } catch (err) { tbody.innerHTML = errorRow(7, err.message); toast(err.message, "error"); }
}

async function tambahTPA() {
  const nama = document.getElementById("inp-tpa-nama").value.trim();
  const kap  = parseFloat(document.getElementById("inp-tpa-kapasitas").value);
  if (!nama)                   { toast("Nama TPA tidak boleh kosong!", "error"); return; }
  if (isNaN(kap) || kap <= 0) { toast("Kapasitas harus lebih dari 0!", "error"); return; }
  const btn = document.querySelector("#modal-tpa .btn-save");
  setLoad(btn, true);
  try {
    await api("POST", "/tpa", { nama, kapasitas_ton: kap });
    closeModal("modal-tpa"); resetForm("modal-tpa");
    toast(`TPA "${nama}" ditambahkan!`);
    loadTPA();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

async function kosongkanTPA(id) {
  if (!confirm(`Kosongkan TPA #${id}? Semua isi akan direset ke 0.`)) return;
  try {
    const r = await api("PATCH", `/tpa/${id}/kosongkan`);
    toast(r.pesan || "TPA berhasil dikosongkan");
    loadTPA();
    refreshStats();

    // ── WORKFLOW: tawarkan buat laporan ──
    setTimeout(() => {
      showWorkflow({
        icon: "fa-file-lines",
        title: "TPA berhasil dikosongkan!",
        desc: "Momen tepat untuk membuat laporan harian. Rekap semua data sekarang?",
        actions: [{
          label: "Buat Laporan Harian",
          color: "blue",
          icon: "fa-file-circle-plus",
          fn: () => {
            closeWorkflow();
            document.querySelector('.nav-link[data-page="laporan"]')?.click();
            setTimeout(() => showModal("modal-laporan"), 300);
          }
        }],
        secondary: null
      });
    }, 400);
  } catch (err) { toast(err.message, "error"); }
}

// ── Terima sampah ke TPA ──
let _currentTpaId = null;

async function bukaTerimaSampah(tpaId, tpaNama) {
  _currentTpaId = tpaId;

  // Update info di modal
  const infoEl = document.getElementById("terima-tpa-info");
  if (infoEl) infoEl.textContent = `TPA tujuan: ${tpaNama} — pilih sampah yang akan diterima.`;

  // Isi dropdown sampah yang sudah diambil
  const select = document.getElementById("inp-terima-sampah-id");
  if (!select) return;

  select.innerHTML = `<option value="">Memuat data...</option>`;
  showModal("modal-terima-tpa");

  try {
    const list = await api("GET", "/sampah");
    const siap  = list.filter(s => s.sudah_diambil);

    if (siap.length === 0) {
      select.innerHTML = `<option value="">Tidak ada sampah yang siap masuk TPA</option>`;
      toast("Belum ada sampah yang sudah diambil. Ambil sampah dulu!", "warning");
      return;
    }

    select.innerHTML = `<option value="">-- Pilih sampah --</option>` +
      siap.map(s =>
        `<option value="${s.id}" data-berat="${s.berat_kg}" data-jenis="${s.jenis}" data-lokasi="${s.lokasi}">
          #${s.id} — ${s.jenis} | ${s.berat_kg} kg | ${s.lokasi}
        </option>`
      ).join("");

    // Tampilkan detail saat pilih
    select.onchange = () => {
      const opt    = select.options[select.selectedIndex];
      const detail = document.getElementById("terima-sampah-detail");
      if (!detail) return;
      if (!opt.value) { detail.style.display = "none"; return; }
      detail.style.display = "block";
      detail.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <span><b>Jenis:</b> ${opt.dataset.jenis}</span>
          <span><b>Berat:</b> ${opt.dataset.berat} kg</span>
          <span><b>Lokasi:</b> ${opt.dataset.lokasi}</span>
        </div>`;
    };

  } catch (err) {
    select.innerHTML = `<option value="">Gagal memuat data</option>`;
    toast(err.message, "error");
  }
}

async function simpanTerimaSampah() {
  const sampahId = parseInt(document.getElementById("inp-terima-sampah-id").value);
  if (!sampahId || isNaN(sampahId)) { toast("Pilih sampah terlebih dahulu!", "error"); return; }

  const btn = document.getElementById("btn-terima-tpa");
  setLoad(btn, true);
  try {
    const r = await api("PATCH", `/tpa/${_currentTpaId}/terima/${sampahId}`);
    closeModal("modal-terima-tpa");
    toast(r.pesan || `Sampah berhasil diterima di TPA`);
    loadTPA();
    refreshStats();

    // ── WORKFLOW: cek apakah TPA hampir penuh, tawarkan laporan ──
    setTimeout(async () => {
      try {
        const tpaData = await api("GET", `/tpa`);
        const tpa = tpaData.find(t => t.id === _currentTpaId);
        if (!tpa) return;
        const pct = tpa.kapasitas_ton > 0 ? (tpa.terisi_ton / tpa.kapasitas_ton) * 100 : 0;
        if (pct >= 80) {
          showWorkflow({
            icon: "fa-triangle-exclamation",
            title: `TPA ${tpa.nama} ${pct.toFixed(0)}% penuh!`,
            desc: "TPA hampir penuh. Buat laporan sekarang atau kosongkan TPA.",
            actions: [
              { label: "Kosongkan TPA", color: "orange", icon: "fa-broom", fn: () => { closeWorkflow(); kosongkanTPA(tpa.id); } },
              { label: "Buat Laporan", color: "blue", icon: "fa-file-lines", fn: () => { closeWorkflow(); document.querySelector('.nav-link[data-page="laporan"]')?.click(); setTimeout(() => showModal("modal-laporan"), 300); } }
            ],
            secondary: null
          });
        }
      } catch {}
    }, 400);
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

async function hapusTPA(id) {
  if (!confirm(`Hapus TPA #${id}?`)) return;
  const row = [...document.querySelectorAll("#tabel-tpa tr")].find(r => r.innerHTML.includes(`#${id}`));
  if (row) { row.classList.add("row-removing"); await new Promise(r => setTimeout(r, 240)); }
  try {
    await api("DELETE", `/tpa/${id}`);
    toast(`TPA #${id} dihapus`);
    loadTPA();
  } catch (err) { toast(err.message, "error"); if (row) row.classList.remove("row-removing"); }
}

// ============================================================
//  LAPORAN
// ============================================================
async function loadLaporan() {
  const box = document.getElementById("laporan-list");
  if (!box) return;
  box.innerHTML = `<div style="text-align:center;padding:40px;color:var(--tx3)">
    <i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;display:block;margin-bottom:8px"></i>
    <span style="font-size:.8rem">Memuat laporan...</span></div>`;
  try {
    const list = await api("GET", "/laporan");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = `<div style="text-align:center;padding:52px">
        <div class="emst-ico" style="margin:0 auto 12px"><i class="fa-solid fa-file-lines"></i></div>
        <p style="font-size:.82rem;font-weight:700;color:var(--tx2)">Belum ada laporan</p>
        <span style="font-size:.73rem;color:var(--tx3)">Klik "Buat Laporan" untuk membuat laporan harian pertama</span>
      </div>`;
      return;
    }
    for (const lap of list) {
      const d = await api("GET", `/laporan/${lap.id}`);
      const catHtml  = d.catatan && d.catatan.length
        ? `<ul class="lc-list">${d.catatan.map(c => `<li>${c}</li>`).join("")}</ul>`
        : `<p style="font-size:.76rem;color:var(--tx3);padding:6px 0">Tidak ada catatan detail.</p>`;
      const warnHtml = d.peringatan && d.peringatan.length
        ? `<div class="lc-warn">
            <div class="warn-ttl"><i class="fa-solid fa-triangle-exclamation"></i> Peringatan (${d.peringatan.length})</div>
            <ul>${d.peringatan.map(p => `<li>${p}</li>`).join("")}</ul>
          </div>` : "";
      box.innerHTML += `
        <div class="lc">
          <div class="lc-top">
            <h3><i class="fa-solid fa-file-lines"></i> Laporan — ${d.tanggal}</h3>
            <div class="abt-g">
              <button class="abt wa" onclick="showTambahPeringatan(${d.id})"><i class="fa-solid fa-triangle-exclamation"></i> Peringatan</button>
              <button class="abt da" onclick="hapusLaporan(${d.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          <div class="lc-body">
            <div class="lc-stats">
              <div class="lc-stat"><span class="ls-lbl">Total Item</span><span class="ls-val">${d.total_sampah}</span></div>
              <div class="lc-stat"><span class="ls-lbl">Total Berat</span><span class="ls-val">${d.total_berat_kg.toFixed(1)}<span class="ls-un"> kg</span></span></div>
              <div class="lc-stat"><span class="ls-lbl">Peringatan</span><span class="ls-val" style="${d.peringatan.length ? "color:var(--ye)" : ""}">${d.peringatan.length}</span></div>
            </div>
            ${catHtml}${warnHtml}
          </div>
        </div>`;
    }
  } catch (err) {
    box.innerHTML = `<div style="text-align:center;padding:36px;color:var(--re);font-size:.8rem"><i class="fa-solid fa-circle-xmark" style="font-size:1.3rem;display:block;margin-bottom:8px"></i>${err.message}</div>`;
    toast(err.message, "error");
  }
}

async function buatLaporan() {
  const tanggal = document.getElementById("inp-laporan-tanggal").value.trim();
  if (!tanggal) { toast("Isi tanggal laporan!", "error"); return; }
  const btn = document.querySelector("#modal-laporan .btn-save");
  setLoad(btn, true);
  try {
    const r = await api("POST", "/laporan", { tanggal });
    closeModal("modal-laporan"); resetForm("modal-laporan");
    toast(`Laporan "${r.tanggal}" dibuat — ${r.total_sampah} item, ${r.total_berat_kg} kg`);
    loadLaporan();
  } catch (err) { toast(err.message, "error"); }
  finally { setLoad(btn, false); }
}

function showTambahPeringatan(id) {
  const p = prompt("Masukkan pesan peringatan:");
  if (!p || !p.trim()) return;
  api("PATCH", `/laporan/${id}/peringatan`, { pesan: p.trim() })
    .then(() => { toast("Peringatan ditambahkan"); loadLaporan(); })
    .catch(err => toast(err.message, "error"));
}

async function hapusLaporan(id) {
  if (!confirm(`Hapus laporan #${id}?`)) return;
  try {
    await api("DELETE", `/laporan/${id}`);
    toast(`Laporan #${id} dihapus`);
    loadLaporan();
  } catch (err) { toast(err.message, "error"); }
}

// ============================================================
//  WORKFLOW ENGINE — popup panduan langkah selanjutnya
// ============================================================

function showWorkflow({ icon, title, desc, actions, secondary }) {
  // Hapus workflow lama kalau ada
  closeWorkflow();

  const el = document.createElement("div");
  el.id = "workflow-popup";
  el.style.cssText = `
    position:fixed; bottom:80px; right:20px; z-index:8000;
    width:320px; background:var(--surface);
    border:1px solid var(--bd2); border-radius:var(--r3);
    box-shadow:var(--sh-lg);
    animation:wfIn .3s cubic-bezier(.34,1.56,.64,1);
    overflow:hidden;
  `;

  const actionsHtml = (actions || []).map(a => {
    const colors = {
      green:  "background:linear-gradient(135deg,var(--gr1),var(--te1));color:#fff",
      blue:   "background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff",
      orange: "background:linear-gradient(135deg,#f97316,#ea580c);color:#fff",
      red:    "background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff",
    };
    return `<button onclick="window._wfAction(${actions.indexOf(a)})" style="
      display:flex;align-items:center;gap:7px;width:100%;
      padding:8px 12px;border-radius:var(--r-sm,8px);border:none;cursor:pointer;
      font-family:'Outfit',sans-serif;font-size:.77rem;font-weight:700;
      text-align:left;transition:all .14s;margin-bottom:6px;
      ${colors[a.color] || colors.green}
    ">
      <i class="fa-solid ${a.icon}" style="font-size:.8rem;width:16px;text-align:center"></i>
      ${a.label}
    </button>`;
  }).join("");

  const secHtml = secondary ? `
    <button onclick="window._wfSecondary()" style="
      width:100%;padding:7px 12px;background:none;border:none;
      cursor:pointer;font-family:'Outfit',sans-serif;
      font-size:.73rem;font-weight:600;color:var(--tx2);text-align:center;
    ">${secondary.label} →</button>` : "";

  el.innerHTML = `
    <div style="
      padding:12px 14px 10px;
      background:linear-gradient(90deg,rgba(16,185,129,.08),rgba(14,165,233,.05));
      border-bottom:1px solid var(--bd);
      display:flex;align-items:flex-start;gap:10px;
    ">
      <div style="
        width:32px;height:32px;border-radius:8px;flex-shrink:0;
        background:linear-gradient(135deg,var(--gr1),var(--te1));
        display:flex;align-items:center;justify-content:center;color:#fff;font-size:.82rem;
      "><i class="fa-solid ${icon}"></i></div>
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:800;color:var(--tx1)">${title}</div>
        <div style="font-size:.72rem;color:var(--tx2);margin-top:2px">${desc}</div>
      </div>
      <button onclick="closeWorkflow()" style="
        width:24px;height:24px;border-radius:6px;border:1px solid var(--bd);
        background:none;cursor:pointer;color:var(--tx3);font-size:.7rem;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      ">✕</button>
    </div>
    <div style="padding:12px 14px 4px">
      ${actionsHtml}
      ${secHtml}
    </div>
  `;

  // Simpan actions dan secondary ke window untuk onclick
  window._wfActions   = actions || [];
  window._wfAction    = (i) => { if (window._wfActions[i]) window._wfActions[i].fn(); };
  window._wfSecondary = secondary ? secondary.fn : closeWorkflow;

  document.body.appendChild(el);

  // Auto-dismiss setelah 12 detik
  el._timeout = setTimeout(() => closeWorkflow(), 12000);
}

function closeWorkflow() {
  const el = document.getElementById("workflow-popup");
  if (el) {
    clearTimeout(el._timeout);
    el.style.animation = "wfOut .2s ease forwards";
    setTimeout(() => el.remove(), 190);
  }
}

// Helper: buka terima ke TPA dari workflow
async function bukaTerimaKeTPA(tpaId, tpaNama) {
  closeWorkflow();
  _currentTpaId = tpaId;
  const infoEl = document.getElementById("terima-tpa-info");
  if (infoEl) infoEl.textContent = `TPA tujuan: ${tpaNama} — pilih sampah yang akan diterima.`;
  const select = document.getElementById("inp-terima-sampah-id");
  if (select) select.innerHTML = `<option value="">Memuat...</option>`;
  showModal("modal-terima-tpa");
  try {
    const list = await api("GET", "/sampah");
    const siap = list.filter(s => s.sudah_diambil);
    if (!siap.length) {
      if (select) select.innerHTML = `<option value="">Tidak ada sampah siap masuk TPA</option>`;
      return;
    }
    if (select) {
      select.innerHTML = `<option value="">-- Pilih sampah --</option>` +
        siap.map(s => `<option value="${s.id}">#${s.id} — ${s.jenis} | ${s.berat_kg} kg | ${s.lokasi}</option>`).join("");
    }
  } catch {}
}

// Inject animasi workflow ke CSS sekali
(function injectWfCSS() {
  const s = document.createElement("style");
  s.textContent = `
    @keyframes wfIn  { from{opacity:0;transform:translateY(12px) scale(.96)} to{opacity:1;transform:none} }
    @keyframes wfOut { from{opacity:1;transform:none} to{opacity:0;transform:translateY(8px) scale(.97)} }
  `;
  document.head.appendChild(s);
})();

// ============================================================
//  QUICK ACTION — panel aksi cepat di dashboard
// ============================================================
async function loadQuickAction() {
  const panel = document.getElementById("quick-action-panel");
  if (!panel) return;

  try {
    const [dash, sampahList, kList, tpaList] = await Promise.all([
      api("GET", "/dashboard"),
      api("GET", "/sampah"),
      api("GET", "/kendaraan"),
      api("GET", "/tpa"),
    ]);

    const belum   = sampahList.filter(s => !s.sudah_diambil);
    const sudah   = sampahList.filter(s => s.sudah_diambil);
    const kAktif  = kList.filter(k => k.kondisi !== "Servis" && k.muatan_kg > 0);
    const tpaFull = tpaList.filter(t => t.kapasitas_ton > 0 && (t.terisi_ton / t.kapasitas_ton) >= 0.8);

    const actions = [];

    if (belum.length > 0)
      actions.push({
        icon: "fa-trash-can", color: "#10b981",
        label: `${belum.length} sampah belum diambil`,
        sub: "Klik untuk lihat dan ambil sekarang",
        fn: () => document.querySelector('.nav-link[data-page="sampah"]')?.click()
      });

    if (kAktif.length > 0)
      actions.push({
        icon: "fa-truck", color: "#3b82f6",
        label: `${kAktif.length} kendaraan bermuatan`,
        sub: "Klik untuk bongkar muatan di TPA",
        fn: () => document.querySelector('.nav-link[data-page="kendaraan"]')?.click()
      });

    if (tpaFull.length > 0)
      actions.push({
        icon: "fa-industry", color: "#f97316",
        label: `${tpaFull.length} TPA hampir penuh (≥80%)`,
        sub: "Klik untuk kosongkan segera",
        fn: () => document.querySelector('.nav-link[data-page="tpa"]')?.click()
      });

    if (sudah.length > 0)
      actions.push({
        icon: "fa-file-circle-plus", color: "#8b5cf6",
        label: "Buat laporan harian",
        sub: `${sudah.length} sampah siap direkap menjadi laporan`,
        fn: () => {
          document.querySelector('.nav-link[data-page="laporan"]')?.click();
          setTimeout(() => showModal("modal-laporan"), 300);
        }
      });

    if (actions.length === 0) {
      panel.innerHTML = "";
      const empty = document.createElement("div");
      empty.style.cssText = "display:flex;align-items:center;gap:10px;padding:14px 16px;font-size:.8rem;color:var(--tx2)";
      empty.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--gr1);font-size:1rem"></i>
        Semua berjalan lancar! Tidak ada tindakan yang diperlukan saat ini.`;
      panel.appendChild(empty);
      return;
    }

    // ── Simpan fungsi ke registry global agar tidak ada kode di onclick HTML ──
    window._qaActions = actions.map(a => a.fn);

    panel.innerHTML = "";
    actions.forEach((a, i) => {
      const btn = document.createElement("button");
      btn.style.cssText = [
        "display:flex", "align-items:center", "gap:12px", "width:100%",
        "padding:11px 14px", "background:none", "border:none",
        `border-bottom:${i < actions.length - 1 ? "1px solid var(--bd)" : "none"}`,
        "cursor:pointer", "text-align:left", "transition:background .12s",
        "font-family:'Outfit',sans-serif"
      ].join(";");

      btn.addEventListener("mouseover", () => btn.style.background = "var(--bg2)");
      btn.addEventListener("mouseout",  () => btn.style.background = "none");
      btn.addEventListener("click",     () => window._qaActions[i]());

      // Icon box
      const iconBox = document.createElement("div");
      iconBox.style.cssText = [
        "width:36px", "height:36px", "border-radius:9px", "flex-shrink:0",
        `background:${a.color}22`,
        "display:flex", "align-items:center", "justify-content:center",
        `color:${a.color}`, "font-size:.9rem"
      ].join(";");
      iconBox.innerHTML = `<i class="fa-solid ${a.icon}"></i>`;

      // Text
      const text = document.createElement("div");
      const title = document.createElement("div");
      title.style.cssText = "font-size:.81rem;font-weight:700;color:var(--tx1)";
      title.textContent = a.label;

      const sub = document.createElement("div");
      sub.style.cssText = "font-size:.71rem;color:var(--tx2);margin-top:1px";
      sub.textContent = a.sub;

      text.appendChild(title);
      text.appendChild(sub);

      // Arrow
      const arrow = document.createElement("i");
      arrow.className = "fa-solid fa-chevron-right";
      arrow.style.cssText = "color:var(--tx3);font-size:.7rem;margin-left:auto;flex-shrink:0";

      btn.appendChild(iconBox);
      btn.appendChild(text);
      btn.appendChild(arrow);
      panel.appendChild(btn);
    });

  } catch (err) {
    const panel2 = document.getElementById("quick-action-panel");
    if (panel2) {
      panel2.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.style.cssText = "padding:14px 16px;font-size:.79rem;color:var(--tx3)";
      errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:var(--re);margin-right:6px"></i>Gagal memuat aksi. Pastikan backend aktif.`;
      panel2.appendChild(errEl);
    }
  }
}

// ============================================================
//  INIT — cek backend lalu load dashboard
// ============================================================
(async function init() {
  // Scroll-to-top button
  const scrollBtn = document.getElementById("scroll-top");
  window.addEventListener("scroll", () => {
    if (scrollBtn) scrollBtn.classList.toggle("show", window.scrollY > 300);
  }, { passive: true });

  try {
    await api("GET", "/");
    loadDashboard();
    cekNotifDot();
    // Auto-refresh dashboard setiap 30 detik
    setInterval(() => {
      const isDashboard = document.getElementById("page-dashboard")?.classList.contains("active");
      if (isDashboard) loadDashboard();
    }, 30000);
    // Refresh notif setiap 60 detik
    setInterval(cekNotifDot, 60000);
  } catch (err) {
    const b = document.createElement("div");
    b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#dc2626,#ef4444);color:#fff;padding:10px 18px;display:flex;align-items:center;gap:10px;font-family:'Outfit',sans-serif;font-size:.79rem;font-weight:600;box-shadow:0 4px 20px rgba(239,68,68,.3)";
    b.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>
      <span>Backend tidak aktif — jalankan: <code style="background:rgba(255,255,255,.2);padding:2px 7px;border-radius:4px">cd backend &amp;&amp; python -m uvicorn main:app --reload</code></span>
      <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer">✕</button>`;
    document.body.appendChild(b);
  }
})();


// ============================================================
//  ANALYTICS — Area Chart + Real-time
// ============================================================

// State analytics
let _analyticsData  = null;   // data harian cache
let _activeMetric   = "total"; // metrik aktif di chart
let _rtInterval     = null;   // interval real-time
let _chartCanvas    = null;
let _chartCtx       = null;
let _animFrame      = null;

// Warna per metrik
const METRIC_COLOR = {
  total  : { line: "#3b82f6", fill: "rgba(59,130,246,", dot: "#3b82f6" },
  diambil: { line: "#10b981", fill: "rgba(16,185,129,",  dot: "#10b981" },
  belum  : { line: "#f97316", fill: "rgba(249,115,22,",  dot: "#f97316" },
  berat  : { line: "#8b5cf6", fill: "rgba(139,92,246,",  dot: "#8b5cf6" },
};

const METRIC_LABEL = {
  total: "Total Masuk", diambil: "Diambil",
  belum: "Belum", berat: "Berat (kg)",
};

// ── Load halaman analytics ──
async function loadAnalytics() {
  await Promise.all([ loadHarian(), loadRealtime() ]);

  // Start polling real-time setiap 30 detik
  if (_rtInterval) clearInterval(_rtInterval);
  _rtInterval = setInterval(async () => {
    const isActive = document.getElementById("page-analytics")?.classList.contains("active");
    if (isActive) await Promise.all([ loadRealtime(), loadHarian() ]);
  }, 30000);
}

// ── Load data 7 hari ──
async function loadHarian() {
  try {
    const d = await api("GET", "/statistik/harian");
    _analyticsData = d;
    // Render chart dengan delay supaya canvas sudah punya ukuran
    setTimeout(() => renderChart(), 50);
    renderSummary(d.summary);
    renderAnTable(d.hari);
    // Update mini chart di dashboard juga
    renderMiniChart(d.hari);
    updateDspKpi(d.summary);
  } catch (err) {
    toast("Gagal load data harian: " + err.message, "error");
  }
}

// ── Load data real-time ──
async function loadRealtime() {
  try {
    // Ambil data dashboard (selalu ada data lengkap)
    const dash = await api("GET", "/dashboard");

    // Coba ambil realtime juga
    let rt = null;
    try { rt = await api("GET", "/statistik/realtime"); } catch {}

    const hi = rt?.hari_ini;

    // Hari ini: pakai data realtime kalau ada, fallback ke dashboard total
    const totalVal   = (hi && hi.total > 0)   ? hi.total   : dash.sampah.total;
    const diambilVal = (hi && hi.diambil > 0) ? hi.diambil : dash.sampah.sudah_diambil;
    const beratVal   = (hi && hi.berat > 0)   ? hi.berat   : dash.sampah.total_berat_kg;
    const b3Val      = hi ? hi.b3 : 0;

    // Set nilai
    setVal("rt-today-total",   totalVal);
    setVal("rt-today-diambil", diambilVal);
    setVal("rt-today-b3",      b3Val);

    // Berat — simpan langsung sebagai teks di node pertama (ada span .rt-unit)
    const beratEl = document.getElementById("rt-today-berat");
    if (beratEl) {
      beratEl.innerHTML = `${Number(beratVal).toFixed(1)} <span class="rt-unit">kg</span>`;
    }

    // Badge perubahan
    const ch = rt?.perubahan;
    if (ch) {
      setChange("rt-total-change",   ch.total);
      setChange("rt-diambil-change", ch.diambil);
      setChange("rt-berat-change",   ch.berat);
    } else {
      // Tidak ada data kemarin — tampilkan info total
      const pctDiambil = totalVal > 0 ? Math.round((diambilVal / totalVal) * 100) : 0;
      const el1 = document.getElementById("rt-total-change");
      const el2 = document.getElementById("rt-diambil-change");
      const el3 = document.getElementById("rt-berat-change");
      if (el1) { el1.className = "rt-kpi-change flat"; el1.innerHTML = `<i class="fa-solid fa-database" style="font-size:.6rem"></i> Total semua data`; }
      if (el2) { el2.className = "rt-kpi-change up";   el2.innerHTML = `<i class="fa-solid fa-check" style="font-size:.6rem"></i> ${pctDiambil}% dari total`; }
      if (el3) { el3.className = "rt-kpi-change flat"; el3.innerHTML = `<i class="fa-solid fa-weight-hanging" style="font-size:.6rem"></i> Total keseluruhan`; }
    }

  } catch (err) {
    // Last resort fallback — isi dengan 0
    ["rt-today-total","rt-today-diambil","rt-today-b3"].forEach(id => setVal(id, 0));
    const beratEl = document.getElementById("rt-today-berat");
    if (beratEl) beratEl.innerHTML = `0 <span class="rt-unit">kg</span>`;
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setChange(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  const abs = Math.abs(pct);
  if (pct > 0) {
    el.className = "rt-kpi-change up";
    el.innerHTML = `<i class="fa-solid fa-arrow-up" style="font-size:.6rem"></i> +${abs}% vs kemarin`;
  } else if (pct < 0) {
    el.className = "rt-kpi-change down";
    el.innerHTML = `<i class="fa-solid fa-arrow-down" style="font-size:.6rem"></i> ${pct}% vs kemarin`;
  } else {
    el.className = "rt-kpi-change flat";
    el.innerHTML = `<i class="fa-solid fa-minus" style="font-size:.6rem"></i> Sama seperti kemarin`;
  }
}

// ── Toggle metrik ──
document.querySelectorAll(".ct-btn[data-metric]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ct-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    _activeMetric = btn.dataset.metric;
    renderChart();
  });
});

// ── Render ringkasan ──
function renderSummary(s) {
  if (!s) return;
  setVal("sum-total", s.total_minggu);
  setVal("sum-berat", s.berat_minggu + " kg");
  setVal("sum-avg",   s.avg_harian + " / hari");
  setVal("sum-peak",  s.hari_terbanyak + " (" + s.max_count + ")");
}

// ── Render tabel detail ──
function renderAnTable(hari) {
  const tbody = document.getElementById("an-table-body");
  if (!tbody || !hari) return;

  const maxTotal = Math.max(...hari.map(h => h.total), 1);
  const peakIdx  = hari.reduce((pi, h, i, a) => h.total > a[pi].total ? i : pi, 0);

  tbody.innerHTML = hari.map((h, i) => {
    const pct     = maxTotal > 0 ? Math.round((h.diambil / (h.total || 1)) * 100) : 0;
    const barW    = Math.round((h.total / maxTotal) * 100);
    const isPeak  = i === peakIdx;
    return `<tr class="${isPeak ? "peak-row" : ""}">
      <td><b>${h.label}</b>${isPeak ? ' <span class="badge badge-green" style="font-size:.6rem">Terbanyak</span>' : ""}</td>
      <td><b style="color:var(--tx1)">${h.total}</b></td>
      <td style="color:var(--gr1);font-weight:600">${h.diambil}</td>
      <td style="color:var(--or)">${h.belum}</td>
      <td style="color:var(--tx2)">${h.berat_kg}</td>
      <td style="min-width:130px">
        <div class="an-prog-wrap">
          <div class="an-prog-track"><div class="an-prog-fill" style="width:${barW}%"></div></div>
          <span class="an-prog-pct">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ══════════════════════════════════════════════
//  AREA CHART — Canvas API
// ══════════════════════════════════════════════
function renderChart() {
  if (!_analyticsData) return;

  const canvas = document.getElementById("area-chart");
  if (!canvas) return;

  // Resize canvas to container — fallback ke ukuran fixed kalau belum layout
  const wrap = canvas.parentElement;
  const wrapW = wrap.clientWidth  > 0 ? wrap.clientWidth  - 40 : 600;
  const wrapH = wrap.clientHeight > 0 ? wrap.clientHeight - 26 : 240;
  canvas.width  = wrapW;
  canvas.height = wrapH;

  const ctx   = canvas.getContext("2d");
  const data  = _analyticsData.hari;
  const vals  = data.map(h => h[_activeMetric] ?? 0);
  const color = METRIC_COLOR[_activeMetric] || METRIC_COLOR.total;

  const W = canvas.width;
  const H = canvas.height;
  const PAD_L = 40, PAD_R = 16, PAD_T = 16, PAD_B = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxVal = Math.max(...vals, 1);
  const minVal = 0;
  const range  = maxVal - minVal || 1;

  // Helper: koordinat titik
  function px(i) { return PAD_L + (i / (vals.length - 1)) * chartW; }
  function py(v) { return PAD_T + chartH - ((v - minVal) / range) * chartH; }

  ctx.clearRect(0, 0, W, H);

  // ── Grid lines ──
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--bd") || "rgba(0,0,0,.07)";
  ctx.lineWidth   = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD_T + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(W - PAD_R, y);
    ctx.stroke();

    // Label Y
    const labelVal = Math.round(maxVal - (maxVal / gridLines) * i);
    ctx.setLineDash([]);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--tx3") || "#94a3b8";
    ctx.font      = "500 10px 'Outfit', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(labelVal, PAD_L - 6, y + 4);
  }

  // ── Smooth line path (cubic bezier) ──
  function smoothPath() {
    ctx.beginPath();
    ctx.moveTo(px(0), py(vals[0]));
    for (let i = 0; i < vals.length - 1; i++) {
      const x0 = px(i), y0 = py(vals[i]);
      const x1 = px(i+1), y1 = py(vals[i+1]);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    }
  }

  // ── Gradient fill ──
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
  grad.addColorStop(0,   color.fill + "0.28)");
  grad.addColorStop(0.6, color.fill + "0.10)");
  grad.addColorStop(1,   color.fill + "0.00)");

  smoothPath();
  ctx.lineTo(px(vals.length - 1), PAD_T + chartH);
  ctx.lineTo(px(0), PAD_T + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Line stroke ──
  ctx.setLineDash([]);
  smoothPath();
  ctx.strokeStyle = color.line;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // ── Dots & label X ──
  vals.forEach((v, i) => {
    const x = px(i), y = py(v);

    // Outer dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = color.line;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color.line;
    ctx.fill();

    // Label hari di bawah
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--tx2") || "#475569";
    ctx.font      = "600 10px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data[i].nama_hari, x, H - 8);
  });

  // Simpan referensi untuk tooltip
  _chartCanvas = canvas;
  _chartCtx    = ctx;
  canvas._vals  = vals;
  canvas._data  = data;
  canvas._pad   = { l: PAD_L, r: PAD_R, t: PAD_T, b: PAD_B };
  canvas._range = { min: minVal, max: maxVal };
  canvas._dims  = { W, H, chartW, chartH };
}

// ── Tooltip on hover ──
document.addEventListener("mousemove", (e) => {
  const canvas = document.getElementById("area-chart");
  if (!canvas || !canvas._vals) return;
  const tooltip = document.getElementById("chart-tooltip");
  if (!tooltip) return;

  const rect   = canvas.getBoundingClientRect();
  const mx     = e.clientX - rect.left;
  const my     = e.clientY - rect.top;

  const { l: PAD_L, r: PAD_R, t: PAD_T, b: PAD_B } = canvas._pad;
  const { W, H, chartW, chartH } = canvas._dims;

  // Cari titik terdekat
  const vals = canvas._vals;
  const data = canvas._data;
  let minDist = Infinity, closestIdx = -1;

  vals.forEach((v, i) => {
    const x = PAD_L + (i / (vals.length - 1)) * chartW;
    const dist = Math.abs(mx - x);
    if (dist < minDist) { minDist = dist; closestIdx = i; }
  });

  if (closestIdx < 0 || minDist > chartW / vals.length) {
    tooltip.classList.remove("show");
    return;
  }

  const d = data[closestIdx];
  const x = PAD_L + (closestIdx / (vals.length - 1)) * chartW;
  const color = METRIC_COLOR[_activeMetric];

  // Posisi tooltip
  const canvasLeft = rect.left + window.scrollX;
  const canvasTop  = rect.top  + window.scrollY;
  const absX = canvasLeft + x;
  const absY = canvasTop  + PAD_T + chartH - ((vals[closestIdx]) / (canvas._range.max || 1)) * chartH;

  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${PAD_T + chartH - ((vals[closestIdx]) / (canvas._range.max || 1)) * chartH}px`;
  tooltip.classList.add("show");

  document.getElementById("ct-header").textContent = d.label;
  document.getElementById("ct-rows").innerHTML = `
    <div class="ct-row"><span class="ct-row-dot" style="background:#3b82f6"></span><span>Total</span><span class="ct-row-val">${d.total}</span></div>
    <div class="ct-row"><span class="ct-row-dot" style="background:#10b981"></span><span>Diambil</span><span class="ct-row-val">${d.diambil}</span></div>
    <div class="ct-row"><span class="ct-row-dot" style="background:#f97316"></span><span>Belum</span><span class="ct-row-val">${d.belum}</span></div>
    <div class="ct-row"><span class="ct-row-dot" style="background:#8b5cf6"></span><span>Berat</span><span class="ct-row-val">${d.berat_kg} kg</span></div>
  `;
});

// Sembunyikan tooltip saat keluar dari area chart
document.addEventListener("mouseleave", () => {
  const tooltip = document.getElementById("chart-tooltip");
  if (tooltip) tooltip.classList.remove("show");
}, true);

document.getElementById("area-chart")?.addEventListener("mouseleave", () => {
  const tooltip = document.getElementById("chart-tooltip");
  if (tooltip) tooltip.classList.remove("show");
});

// Re-render chart saat window resize
window.addEventListener("resize", () => {
  if (_analyticsData && document.getElementById("page-analytics")?.classList.contains("active")) {
    renderChart();
  }
});

// ══════════════════════════════════════════════
//  MINI CHART — Dashboard preview
// ══════════════════════════════════════════════
function renderMiniChart(hari) {
  const canvas = document.getElementById("mini-chart");
  if (!canvas || !hari || hari.length === 0) return;

  const W = canvas.offsetWidth  || 240;
  const H = canvas.offsetHeight || 110;
  canvas.width  = W;
  canvas.height = H;

  const ctx  = canvas.getContext("2d");
  const vals = hari.map(h => h.total);
  const maxV = Math.max(...vals, 1);

  const PAD_L = 4, PAD_R = 4, PAD_T = 10, PAD_B = 20;
  const cW = W - PAD_L - PAD_R;
  const cH = H - PAD_T - PAD_B;

  function px(i) { return PAD_L + (i / (vals.length - 1)) * cW; }
  function py(v) { return PAD_T + cH - (v / maxV) * cH; }

  ctx.clearRect(0, 0, W, H);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + cH);
  grad.addColorStop(0,   "rgba(16,185,129,0.3)");
  grad.addColorStop(0.7, "rgba(16,185,129,0.05)");
  grad.addColorStop(1,   "rgba(16,185,129,0.0)");

  // Smooth path
  function drawPath() {
    ctx.beginPath();
    ctx.moveTo(px(0), py(vals[0]));
    for (let i = 0; i < vals.length - 1; i++) {
      const cpx = (px(i) + px(i+1)) / 2;
      ctx.bezierCurveTo(cpx, py(vals[i]), cpx, py(vals[i+1]), px(i+1), py(vals[i+1]));
    }
  }

  // Fill area
  drawPath();
  ctx.lineTo(px(vals.length-1), PAD_T + cH);
  ctx.lineTo(px(0), PAD_T + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  drawPath();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth   = 2;
  ctx.lineJoin    = "round";
  ctx.setLineDash([]);
  ctx.stroke();

  // Dots + label hari
  vals.forEach((v, i) => {
    const x = px(i), y = py(v);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label hari
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "500 9px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(hari[i].nama_hari, x, H - 5);
  });
}

// Update KPI di preview card dashboard
function updateDspKpi(summary) {
  if (!summary) return;
  const s = id => document.getElementById(id);
  if (s("dsp-total")) s("dsp-total").textContent = summary.total_minggu;
  if (s("dsp-avg"))   s("dsp-avg").textContent   = summary.avg_harian + " / hari";
  if (s("dsp-berat")) s("dsp-berat").textContent = summary.berat_minggu + " kg";
  if (s("dsp-peak"))  s("dsp-peak").textContent  = summary.hari_terbanyak;
}

// Klik preview card → pindah ke analytics
const dspPreview = document.getElementById("db-stat-preview");
if (dspPreview) {
  dspPreview.addEventListener("click", () => {
    const lnk = document.querySelector('.nav-link[data-page="analytics"]');
    if (lnk) lnk.click();
  });
}

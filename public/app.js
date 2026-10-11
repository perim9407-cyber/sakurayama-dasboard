const pageInfo = {
  "Home": ["Welcome back.", "Semua tools kamu, dalam satu dashboard."],
  "Converter": ["Media Converter", "Ruang kerja untuk fitur konversi media."],
  "Bulk Convert": ["Bulk Convert", "Kelola beberapa item dalam satu alur kerja."],
  "Chat AI": ["Chat AI", "Area untuk mengembangkan fitur asisten AI."],
  "History": ["Activity History", "Riwayat aktivitas akan ditampilkan di sini."],
  "Roblox Spoofer": ["Roblox Spoofer", "Halaman tools Roblox. Gunakan hanya untuk pengujian yang sah dan sesuai ketentuan platform."],
  "Roblox Publishing": ["Roblox Publishing", "Persiapan alur publikasi aset Roblox melalui integrasi resmi."],
  "Roblox Asset Permission": ["Roblox Asset Permission", "Ruang untuk memeriksa dan mengelola izin aset melalui akses resmi."],
  "Roblox Settings": ["Roblox Settings", "Konfigurasi integrasi dan preferensi dashboard."],
  "API Limits": ["API Limits", "Informasi batas penggunaan API dan status layanan."],
  "Buy Premium": ["Premium Plans", "Ruang informasi paket premium dan fitur tambahan."]
};

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const crumb = document.getElementById("crumb");
const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");

function navigate(page) {
  const info = pageInfo[page] || [page, "Halaman workspace."];
  crumb.textContent = page;
  pageTitle.textContent = info[0];
  pageDescription.textContent = info[1];
  document.querySelectorAll("[data-page]").forEach(el => {
    if (el.classList.contains("nav-item")) {
      el.classList.toggle("active", el.dataset.page === page);
      if (el.dataset.page === page) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
  });
  document.querySelectorAll(".stat-card,.quick-list button").forEach(el => {
    el.setAttribute("aria-label", "Buka " + el.dataset.page);
  });
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  window.scrollTo({top: 0, behavior: "smooth"});
}

document.querySelectorAll("[data-page]").forEach(el => {
  el.addEventListener("click", () => navigate(el.dataset.page));
});
document.getElementById("menuToggle").addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("show");
});
document.getElementById("closeSidebar").addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
});
document.getElementById("dismissNotice").addEventListener("click", () => {
  document.querySelector(".notice").remove();
});

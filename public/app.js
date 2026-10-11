const pageInfo = {
  "Home": ["Welcome back.", "Semua tools kamu, dalam satu dashboard."],
  "Converter": ["Media Converter", "Konversi dan optimasi file audio maupun gambar secara instan di browser."],
  "Bulk Convert": ["Bulk Convert", "Kelola dan proses banyak file sekaligus dalam satu antrean kerja."],
  "Chat AI": ["Chat AI", "Konsultasi Luau scripting, animasi R6/R15, dan optimasi aset bersama Sakurayama AI."],
  "History": ["Activity History", "Catatan real-time semua aktivitas konversi, spoofing, dan publikasi aset."],
  "Roblox Spoofer": ["Roblox Spoofer", "Re-hash ID animasi, sesuaikan rig R6/R15, dan generate script loader Luau."],
  "Roblox Publishing": ["Roblox Publishing", "Simulasi alur publikasi aset langsung ke Group atau User Roblox Cloud."],
  "Roblox Asset Permission": ["Roblox Asset Permission", "Periksa kepemilikan aset dan kelola daftar Place ID yang diizinkan."],
  "Roblox Settings": ["Roblox Settings", "Konfigurasi Creator ID, Group ID, dan preset default dashboard."],
  "API Limits": ["API Limits", "Pantau pemakaian kuota harian untuk setiap fitur dan modul."],
  "Buy Premium": ["Premium Plans", "Pilih paket kapasitas workspace sesuai kebutuhan tim atau studio kamu."]
};

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const crumb = document.getElementById("crumb");
const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");
const toastContainer = document.getElementById("toastContainer");

// App State
let appState = {
  history: [],
  publishedAssets: [],
  permissions: {},
  settings: {
    creatorType: "Group",
    creatorId: "12094812",
    defaultRig: "R15",
    defaultPriority: "Action",
    autoExportHistory: true
  },
  plan: "Creator+",
  apiUsage: {
    converterUsed: 18,
    converterLimit: 500,
    bulkUsed: 12,
    bulkLimit: 250,
    aiUsed: 9,
    aiLimit: 200,
    robloxUsed: 24,
    robloxLimit: 1000
  }
};

let singleSelectedFile = null;
let lastConvertedFileInfo = null;
let bulkQueue = [];
let chatHistory = [];

// Toast helper (no window.alert)
function showToast(message) {
  if (!toastContainer) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3400);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " · " +
           d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch {
    return isoString;
  }
}

// Navigation
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

  document.querySelectorAll(".page-view").forEach(view => {
    view.classList.toggle("active", view.dataset.view === page);
  });

  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
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
const dismissBtn = document.getElementById("dismissNotice");
if (dismissBtn) {
  dismissBtn.addEventListener("click", () => {
    const notice = document.getElementById("welcomeNotice");
    if (notice) notice.remove();
  });
}

// Live Header Chip
function updateClock() {
  const clockEl = document.getElementById("liveClock");
  if (!clockEl) return;
  const now = new Date();
  clockEl.textContent = now.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
updateClock();

// Sync UI with backend state
async function fetchInitialState() {
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      appState = await res.json();
      renderAllViews();
    }
  } catch (err) {
    console.warn("Gagal memuat state awal:", err);
  }
}

function renderAllViews() {
  renderHomeStats();
  renderHistoryTable();
  renderPublishedTable();
  renderLimits();
  renderSettingsForm();
  renderPlanSelection();
}

function renderHomeStats() {
  const u = appState.apiUsage;
  const homeConv = document.getElementById("homeConverterStat");
  const homePub = document.getElementById("homePublishStat");
  const homeApi = document.getElementById("homeApiStat");
  const homeCreator = document.getElementById("homeCreatorTarget");
  const homeRecent = document.getElementById("homeRecentActivity");

  if (homeConv) homeConv.textContent = `${u.converterUsed} file telah dikonversi`;
  if (homePub) homePub.textContent = `${appState.publishedAssets.length} aset di Roblox Cloud`;
  if (homeApi) {
    const totalUsed = u.converterUsed + u.bulkUsed + u.aiUsed + u.robloxUsed;
    homeApi.textContent = `${totalUsed} total request hari ini`;
  }
  if (homeCreator) {
    homeCreator.textContent = `● ${appState.settings.creatorType} #${appState.settings.creatorId}`;
  }
  if (homeRecent && appState.history.length > 0) {
    const latest = appState.history[0];
    homeRecent.textContent = `Terbaru: [${latest.tool}] ${latest.action} — ${latest.detail}`;
  }
}

// ==========================================
// 1. MEDIA CONVERTER (WEB AUDIO & CANVAS)
// ==========================================
const convCategory = document.getElementById("convCategory");
const convFormat = document.getElementById("convFormat");
const convPitch = document.getElementById("convPitch");
const convPitchVal = document.getElementById("convPitchVal");
const singleFileInput = document.getElementById("singleFileInput");
const singleDropzone = document.getElementById("singleDropzone");

convPitch.addEventListener("input", () => {
  convPitchVal.textContent = Number(convPitch.value).toFixed(2) + "x";
});

convCategory.addEventListener("change", () => {
  const isImage = convCategory.value === "image";
  convFormat.innerHTML = isImage
    ? `<option value="png">PNG (Lossless Decal / UI)</option>
       <option value="webp">WEBP (High Compression)</option>
       <option value="jpeg">JPG (Standard Image)</option>`
    : `<option value="wav">WAV (Lossless PCM 16-bit)</option>
       <option value="ogg">OGG (Roblox Audio Optimized)</option>
       <option value="mp3">MP3 (Standard Audio)</option>`;
  document.getElementById("convSampleRateGroup").classList.toggle("hidden", isImage);
  document.getElementById("convChannelsGroup").classList.toggle("hidden", isImage);
  document.getElementById("convSpeedGroup").classList.toggle("hidden", isImage);
  document.getElementById("convNormalizeGroup").classList.toggle("hidden", isImage);
});

document.getElementById("selectSingleFileBtn").addEventListener("click", () => {
  singleFileInput.click();
});

singleFileInput.addEventListener("change", e => {
  if (e.target.files && e.target.files[0]) {
    setSingleFile(e.target.files[0]);
  }
});

singleDropzone.addEventListener("dragover", e => {
  e.preventDefault();
  singleDropzone.classList.add("dragover");
});
singleDropzone.addEventListener("dragleave", () => {
  singleDropzone.classList.remove("dragover");
});
singleDropzone.addEventListener("drop", e => {
  e.preventDefault();
  singleDropzone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    setSingleFile(e.dataTransfer.files[0]);
  }
});

function setSingleFile(file) {
  singleSelectedFile = file;
  document.getElementById("singleFileName").textContent = file.name;
  document.getElementById("singleFileMeta").textContent = `${file.type || "Media File"} · ${formatBytes(file.size)}`;
  if (file.type.startsWith("image/")) {
    convCategory.value = "image";
    convCategory.dispatchEvent(new Event("change"));
  } else {
    convCategory.value = "audio";
    convCategory.dispatchEvent(new Event("change"));
  }
}

// Generate procedural chime WAV in browser when user clicks "Gunakan Sample Audio"
function createSynthesizedWavBlob(durationSec = 2.4, sampleRate = 44100) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Japanese Pentatonic Sakura Arpeggio notes (Hz)
  const notes = [440.0, 493.88, 523.25, 659.25, 698.46, 880.0];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor((t / durationSec) * notes.length));
    const freq = notes[noteIdx];
    const localT = (t % (durationSec / notes.length));
    const env = Math.exp(-localT * 6.5) * (1 - Math.exp(-localT * 60));
    const wave = (Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(4 * Math.PI * freq * t) * 0.25) * env;
    const sample = Math.max(-1, Math.min(1, wave));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// Helper to sanitize filenames from YouTube titles
function slugifyTitle(title) {
  return String(title || "youtube_audio")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "youtube_audio";
}

// Fetch YouTube info + full audio File object
async function loadYouTubeAsAudioFile(ytUrl, options = {}) {
  const infoRes = await fetch("/api/youtube/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: ytUrl })
  });
  const info = await infoRes.json();
  if (!infoRes.ok) {
    throw new Error(info.error || "URL YouTube tidak valid.");
  }

  const safeBaseName = slugifyTitle(info.title);
  const format = options.format || "wav";
  const sampleRate = options.sampleRate || 44100;
  const channels = options.channels || "stereo";
  const speed = options.speed || 1.0;
  const normalize = options.normalize !== false ? "1" : "0";

  const cleanTitle = String(info.title || "")
    .replace(/\(official.*?\)|\[official.*?\]|\(4k.*?\)|\[4k.*?\]|\(lyrics.*?\)|\(audio.*?\)/gi, "")
    .trim();

  const params = new URLSearchParams({
    v: info.videoId,
    q: `${cleanTitle} ${info.author || ""}`.trim(),
    format,
    sampleRate: String(sampleRate),
    channels,
    speed: String(speed),
    normalize
  });

  const streamRes = await fetch(`/api/youtube/stream?${params.toString()}`);
  if (!streamRes.ok) {
    let errMsg = "Gagal mengambil full audio dari YouTube.";
    try {
      const errData = await streamRes.json();
      if (errData && errData.error) errMsg = errData.error;
    } catch {}
    throw new Error(errMsg);
  }
  const fetchedBlob = await streamRes.blob();
  if (!fetchedBlob || fetchedBlob.size < 1024) {
    throw new Error("Stream audio YouTube kosong atau tidak tersedia.");
  }

  const ext = format === "webm" ? "webm" : format;
  const fileObj = new File([fetchedBlob], `${safeBaseName}.${ext}`, {
    type: fetchedBlob.type || `audio/${ext}`
  });
  fileObj.ytInfo = info;
  return { file: fileObj, info, blob: fetchedBlob };
}

// YouTube Single Converter UI handlers
const ytUrlInput = document.getElementById("ytUrlInput");
const ytPreviewCard = document.getElementById("ytPreviewCard");
let currentYtInfo = null;

function formatDurationClock(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  if (!total) return "Full Track";
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

document.getElementById("sampleYtUrlBtn").addEventListener("click", () => {
  // Full song: Rick Astley - Never Gonna Give You Up (3:34 full track)
  ytUrlInput.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  document.getElementById("fetchYtBtn").click();
});

document.getElementById("fetchYtBtn").addEventListener("click", async () => {
  const urlVal = ytUrlInput.value.trim();
  if (!urlVal) {
    showToast("Paste link YouTube terlebih dahulu.");
    return;
  }

  const btn = document.getElementById("fetchYtBtn");
  const origText = btn.textContent;
  btn.textContent = "Memuat Full Lagu...";
  btn.disabled = true;

  try {
    const infoRes = await fetch("/api/youtube/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlVal })
    });
    const info = await infoRes.json();
    if (!infoRes.ok) {
      throw new Error(info.error || "URL YouTube tidak valid.");
    }

    currentYtInfo = info;
    const safeBaseName = slugifyTitle(info.title);

    document.getElementById("ytThumbImg").src = info.thumbnail;
    document.getElementById("ytVideoTitle").textContent = info.title;
    const durClock = formatDurationClock(info.durationSeconds);
    document.getElementById("ytVideoAuthor").textContent = `${info.author} · Durasi Full: ${durClock} · ID: ${info.videoId}`;
    ytPreviewCard.classList.remove("hidden");

    // Also update dropzone display to reflect the YouTube track
    document.getElementById("singleFileName").textContent = `[YouTube Full Audio] ${info.title}`;
    document.getElementById("singleFileMeta").textContent = `Durasi Penuh (${durClock}) · Nama File: ${safeBaseName}`;
    convCategory.value = "audio";
    convCategory.dispatchEvent(new Event("change"));

    // Clear local file selection so converter uses the full YouTube stream
    singleSelectedFile = null;

    // Immediately trigger full song extraction & preview so the player is ready right away
    document.getElementById("startSingleConvertBtn").click();
  } catch (err) {
    showToast(err.message || "Gagal mengambil video YouTube.");
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
});

document.getElementById("loadSampleAudioBtn").addEventListener("click", () => {
  currentYtInfo = null;
  const wavBlob = createSynthesizedWavBlob(8.0, 44100);
  const sampleFile = new File([wavBlob], "sakura_shrine_chime.wav", { type: "audio/wav" });
  setSingleFile(sampleFile);
  showToast("Sample audio 'sakura_shrine_chime.wav' berhasil dimuat.");
});

// Encode AudioBuffer to WAV Blob
function audioBufferToWavBlob(audioBuffer, targetSampleRate, mono, normalize, pitchScale) {
  const srcRate = audioBuffer.sampleRate;
  const effectiveRate = Math.max(8000, Math.min(96000, Math.round(Number(targetSampleRate) || srcRate)));
  const numChannels = mono ? 1 : Math.min(2, audioBuffer.numberOfChannels);
  const ratio = (srcRate / effectiveRate) * (Number(pitchScale) || 1.0);
  const outLength = Math.max(1, Math.floor(audioBuffer.length / ratio));

  const chData = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    chData.push(audioBuffer.getChannelData(c));
  }

  let peak = 0.001;
  const samples = new Float32Array(outLength * numChannels);

  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(audioBuffer.length - 1, Math.floor(i * ratio));
    if (numChannels === 1) {
      let sum = 0;
      for (let c = 0; c < chData.length; c++) sum += chData[c][srcIdx];
      const val = sum / chData.length;
      samples[i] = val;
      if (Math.abs(val) > peak) peak = Math.abs(val);
    } else {
      for (let c = 0; c < numChannels; c++) {
        const val = chData[c][srcIdx];
        samples[i * numChannels + c] = val;
        if (Math.abs(val) > peak) peak = Math.abs(val);
      }
    }
  }

  const gain = normalize ? (0.95 / peak) : 1.0;
  const byteLength = samples.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(arrayBuffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, effectiveRate, true);
  view.setUint32(28, effectiveRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, byteLength, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function convertImageFile(file, format) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 512;
      canvas.height = img.height || 512;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const mime = format === "webp" ? "image/webp" : format === "jpeg" ? "image/jpeg" : "image/png";
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal mengonversi gambar."));
      }, mime, 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File gambar tidak dapat dibaca."));
    };
    img.src = url;
  });
}

document.getElementById("startSingleConvertBtn").addEventListener("click", async () => {
  const badge = document.getElementById("convStatusBadge");
  const startBtn = document.getElementById("startSingleConvertBtn");
  const origBtnText = startBtn.textContent;

  const category = convCategory.value;
  const format = convFormat.value;
  const sampleRate = Number(document.getElementById("convSampleRate").value) || 44100;
  const channels = document.getElementById("convChannels").value;
  const isMono = channels === "mono";
  const pitch = Number(convPitch.value) || 1.0;
  const normalize = document.getElementById("convNormalize").checked;

  // Check if user wants to convert a YouTube URL (full song)
  const ytUrlVal = ytUrlInput ? ytUrlInput.value.trim() : "";
  if (!singleSelectedFile && (currentYtInfo || ytUrlVal)) {
    badge.textContent = "EXTRACTING FULL SONG...";
    startBtn.textContent = "Mengunduh & Konversi Full Lagu...";
    startBtn.disabled = true;

    try {
      const targetUrl = ytUrlVal || (currentYtInfo && currentYtInfo.url);
      const { file, info, blob } = await loadYouTubeAsAudioFile(targetUrl, {
        format: format === "ogg" || format === "mp3" ? format : "wav",
        sampleRate,
        channels: isMono ? "mono" : "stereo",
        speed: pitch,
        normalize
      });

      currentYtInfo = info;
      document.getElementById("ytThumbImg").src = info.thumbnail;
      document.getElementById("ytVideoTitle").textContent = info.title;
      const durClock = formatDurationClock(info.durationSeconds);
      document.getElementById("ytVideoAuthor").textContent = `${info.author} · Durasi Full: ${durClock} · ID: ${info.videoId}`;
      ytPreviewCard.classList.remove("hidden");

      const safeBase = slugifyTitle(info.title);
      const outName = `${safeBase}.${format === "jpeg" ? "jpg" : format}`;
      const specsText = `YouTube Full Track (${durClock}) → ${format.toUpperCase()} · ${(sampleRate / 1000).toFixed(1)} kHz · ${isMono ? "Mono" : "Stereo"} · ${pitch.toFixed(2)}x · ${formatBytes(blob.size)}`;

      const outUrl = URL.createObjectURL(blob);
      document.getElementById("convImagePreviewWrap").classList.add("hidden");
      const audWrap = document.getElementById("convAudioPreviewWrap");
      audWrap.classList.remove("hidden");
      const player = document.getElementById("convAudioPlayer");
      player.src = outUrl;
      player.load();

      const dlBtn = document.getElementById("convDownloadBtn");
      dlBtn.href = outUrl;
      dlBtn.download = outName;

      document.getElementById("convOutName").textContent = outName;
      document.getElementById("convOutSpecs").textContent = specsText;
      document.getElementById("convResultEmpty").classList.add("hidden");
      document.getElementById("convResultBox").classList.remove("hidden");
      badge.textContent = "COMPLETED (FULL SONG)";

      lastConvertedFileInfo = {
        name: info.title,
        fileName: outName,
        type: "Audio",
        specs: specsText
      };

      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "Converter",
          action: "YouTube Full Audio",
          detail: `[YT Full: ${info.title}] → ${outName} (${specsText})`,
          status: "Success"
        })
      });
      if (res.ok) {
        const data = await res.json();
        appState.history.unshift(data.item);
        appState.apiUsage = data.apiUsage;
        renderAllViews();
      }
      showToast(`Full lagu selesai dikonversi (${durClock}): ${outName}`);
    } catch (err) {
      badge.textContent = "ERROR";
      showToast(err.message || "Gagal mengonversi lagu penuh dari YouTube.");
    } finally {
      startBtn.textContent = origBtnText;
      startBtn.disabled = false;
    }
    return;
  }

  if (!singleSelectedFile) {
    // Auto-create sample audio so the user never hits a dead end
    const wavBlob = createSynthesizedWavBlob(8.0, 44100);
    singleSelectedFile = new File([wavBlob], "sakura_sample_sfx.wav", { type: "audio/wav" });
    setSingleFile(singleSelectedFile);
  }

  badge.textContent = "PROCESSING...";
  startBtn.textContent = "Memproses...";
  startBtn.disabled = true;

  const baseName = singleSelectedFile.name.replace(/\.[^/.]+$/, "");
  const outName = `${baseName}.${format === "jpeg" ? "jpg" : format}`;

  try {
    let outBlob;
    let specsText = "";

    if (category === "image" && singleSelectedFile.type.startsWith("image/")) {
      outBlob = await convertImageFile(singleSelectedFile, format);
      specsText = `${format.toUpperCase()} · Decal Ready · ${formatBytes(outBlob.size)}`;
      const outUrl = URL.createObjectURL(outBlob);
      document.getElementById("convAudioPreviewWrap").classList.add("hidden");
      const imgWrap = document.getElementById("convImagePreviewWrap");
      imgWrap.classList.remove("hidden");
      document.getElementById("convImagePreview").src = outUrl;

      const dlBtn = document.getElementById("convDownloadBtn");
      dlBtn.href = outUrl;
      dlBtn.download = outName;
    } else {
      const arrayBuf = await singleSelectedFile.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      const fullDurationClock = formatDurationClock(decoded.duration);
      outBlob = audioBufferToWavBlob(decoded, sampleRate, isMono, normalize, pitch);
      await audioCtx.close();

      specsText = `Full Audio (${fullDurationClock}) → ${format.toUpperCase()} · ${(sampleRate / 1000).toFixed(1)} kHz · ${isMono ? "Mono" : "Stereo"} · ${pitch.toFixed(2)}x · ${formatBytes(outBlob.size)}`;
      const outUrl = URL.createObjectURL(outBlob);
      document.getElementById("convImagePreviewWrap").classList.add("hidden");
      const audWrap = document.getElementById("convAudioPreviewWrap");
      audWrap.classList.remove("hidden");
      const player = document.getElementById("convAudioPlayer");
      player.src = outUrl;
      player.load();

      const dlBtn = document.getElementById("convDownloadBtn");
      dlBtn.href = outUrl;
      dlBtn.download = outName;
    }

    document.getElementById("convOutName").textContent = outName;
    document.getElementById("convOutSpecs").textContent = specsText;
    document.getElementById("convResultEmpty").classList.add("hidden");
    document.getElementById("convResultBox").classList.remove("hidden");
    badge.textContent = "COMPLETED (FULL)";

    lastConvertedFileInfo = {
      name: baseName,
      fileName: outName,
      type: category === "image" ? "Decal" : "Audio",
      specs: specsText
    };

    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "Converter",
        action: `Konversi ${category.toUpperCase()}`,
        detail: `${singleSelectedFile.name} → ${outName} (${specsText})`,
        status: "Success"
      })
    });
    if (res.ok) {
      const data = await res.json();
      appState.history.unshift(data.item);
      appState.apiUsage = data.apiUsage;
      renderAllViews();
    }
    showToast(`Konversi selesai: ${outName}`);
  } catch (err) {
    badge.textContent = "ERROR";
    showToast("Gagal memproses file: " + (err.message || "Format tidak didukung"));
  } finally {
    startBtn.textContent = origBtnText;
    startBtn.disabled = false;
  }
});

document.getElementById("resetSingleConvertBtn").addEventListener("click", () => {
  singleSelectedFile = null;
  currentYtInfo = null;
  if (ytUrlInput) ytUrlInput.value = "";
  if (ytPreviewCard) ytPreviewCard.classList.add("hidden");
  document.getElementById("singleFileName").textContent = "Atau klik / tarik file Audio & Gambar lokal ke sini";
  document.getElementById("singleFileMeta").textContent = "Mendukung WAV, MP3, OGG, FLAC, PNG, JPG, WEBP (Durasi Full Tanpa Batas)";
  document.getElementById("convResultEmpty").classList.remove("hidden");
  document.getElementById("convResultBox").classList.add("hidden");
  document.getElementById("convStatusBadge").textContent = "READY";
});

document.getElementById("sendToPublishBtn").addEventListener("click", () => {
  if (lastConvertedFileInfo) {
    document.getElementById("pubName").value = lastConvertedFileInfo.name;
    document.getElementById("pubType").value = lastConvertedFileInfo.type;
    document.getElementById("pubDesc").value = `Hasil konversi Sakurayama Converter (${lastConvertedFileInfo.specs})`;
  }
  navigate("Roblox Publishing");
  showToast("Data aset diteruskan ke Roblox Publishing.");
});

// ==========================================
// 2. BULK CONVERT (FILES + YOUTUBE URLS)
// ==========================================
const bulkFilesInput = document.getElementById("bulkFilesInput");
const bulkTableBody = document.getElementById("bulkTableBody");
const bulkYtUrlInput = document.getElementById("bulkYtUrlInput");

document.getElementById("selectBulkFilesBtn").addEventListener("click", () => {
  bulkFilesInput.click();
});

bulkFilesInput.addEventListener("change", e => {
  const files = Array.from(e.target.files || []);
  files.forEach(file => {
    bulkQueue.push({
      id: "bq-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      file,
      name: file.name,
      size: file.size,
      status: "Queued",
      downloadUrl: null,
      outName: null
    });
  });
  renderBulkTable();
});

document.getElementById("addBulkYtBtn").addEventListener("click", async () => {
  const urlVal = (bulkYtUrlInput.value || "").trim();
  if (!urlVal) {
    showToast("Masukkan URL YouTube terlebih dahulu.");
    return;
  }
  const btn = document.getElementById("addBulkYtBtn");
  const orig = btn.textContent;
  btn.textContent = "Memuat Info...";
  btn.disabled = true;

  try {
    const infoRes = await fetch("/api/youtube/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlVal })
    });
    const info = await infoRes.json();
    if (!infoRes.ok) {
      throw new Error(info.error || "URL YouTube tidak valid.");
    }
    const durClock = formatDurationClock(info.durationSeconds);
    bulkQueue.push({
      id: "bq-yt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
      ytUrl: info.url,
      ytInfo: info,
      file: null,
      name: `[YouTube Full ${durClock}] ${info.title}`,
      rawBaseName: slugifyTitle(info.title),
      size: 0,
      status: "Queued",
      downloadUrl: null,
      outName: null
    });
    bulkYtUrlInput.value = "";
    renderBulkTable();
    showToast(`Lagu YouTube "${info.title}" (${durClock}) ditambahkan ke antrean.`);
  } catch (err) {
    showToast(err.message || "Gagal menambahkan URL YouTube.");
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
});

document.getElementById("addDemoBatchBtn").addEventListener("click", () => {
  const demoNames = ["katana_slash_01.wav", "shrine_bell_loop.wav", "dash_wind_burst.wav"];
  demoNames.forEach((name, idx) => {
    const blob = createSynthesizedWavBlob(4.0 + idx * 1.5, 44100);
    const file = new File([blob], name, { type: "audio/wav" });
    bulkQueue.push({
      id: "bq-" + Date.now() + "-" + idx + Math.random().toString(36).slice(2, 5),
      file,
      name: file.name,
      size: file.size,
      status: "Queued",
      downloadUrl: null,
      outName: null
    });
  });
  renderBulkTable();
  showToast("3 sample audio berhasil ditambahkan ke antrean Bulk Convert.");
});

function renderBulkTable() {
  const format = document.getElementById("bulkTargetFormat").value;
  const prefix = document.getElementById("bulkPrefix").value || "";
  document.getElementById("bulkSummaryText").textContent = `${bulkQueue.length} file dalam antrean`;

  if (bulkQueue.length === 0) {
    bulkTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">Antrean masih kosong. Tambahkan file atau gunakan tombol "+ Tambah 3 Sample File".</td></tr>`;
    return;
  }

  bulkTableBody.innerHTML = bulkQueue.map(item => {
    const base = item.rawBaseName || item.name.replace(/\.[^/.]+$/, "");
    const targetName = item.outName || `${prefix}${base}.${format}`;
    const statusBadge = item.status === "Completed"
      ? `<span class="good">● Selesai (Full)</span>`
      : item.status === "Processing"
      ? `<span class="pending">Memproses Full...</span>`
      : `<span class="muted-text">Menunggu</span>`;

    const sizeText = item.size > 0
      ? formatBytes(item.size)
      : item.ytInfo && item.ytInfo.durationSeconds
      ? `Full (${formatDurationClock(item.ytInfo.durationSeconds)})`
      : "Full Track";

    const previewPlayer = item.downloadUrl && (format === "wav" || format === "ogg" || format === "mp3")
      ? `<div style="margin-top:6px;"><audio controls src="${item.downloadUrl}" style="height:28px;max-width:220px;"></audio></div>`
      : "";

    const actionHtml = item.downloadUrl
      ? `<a href="${item.downloadUrl}" download="${targetName}" class="btn-secondary compact-btn">Download</a>`
      : `<button type="button" class="btn-ghost compact-btn remove-bulk-btn" data-id="${item.id}">Hapus</button>`;

    return `<tr>
      <td><strong>${item.name}</strong>${previewPlayer}</td>
      <td class="mono-text">${sizeText}</td>
      <td class="mono-text gold-text">${targetName}</td>
      <td>${statusBadge}</td>
      <td style="text-align:right;">${actionHtml}</td>
    </tr>`;
  }).join("");

  bulkTableBody.querySelectorAll(".remove-bulk-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      bulkQueue = bulkQueue.filter(q => q.id !== btn.dataset.id);
      renderBulkTable();
    });
  });
}

document.getElementById("bulkTargetFormat").addEventListener("change", renderBulkTable);
document.getElementById("bulkPrefix").addEventListener("input", renderBulkTable);

document.getElementById("clearBulkBtn").addEventListener("click", () => {
  bulkQueue = [];
  renderBulkTable();
});

document.getElementById("runBulkConvertBtn").addEventListener("click", async () => {
  if (bulkQueue.length === 0) {
    showToast("Tambahkan file ke antrean terlebih dahulu.");
    return;
  }

  const format = document.getElementById("bulkTargetFormat").value;
  const sampleRate = Number(document.getElementById("bulkSampleRate").value) || 44100;
  const prefix = document.getElementById("bulkPrefix").value || "";

  for (const item of bulkQueue) {
    if (item.status === "Completed") continue;
    item.status = "Processing";
    renderBulkTable();

    try {
      const base = item.rawBaseName || item.name.replace(/\.[^/.]+$/, "");
      item.outName = `${prefix}${base}.${format}`;

      if (item.ytUrl) {
        const outAudioFmt = format === "ogg" || format === "mp3" ? format : "wav";
        item.outName = `${prefix}${base}.${outAudioFmt}`;
        const { blob } = await loadYouTubeAsAudioFile(item.ytUrl, {
          format: outAudioFmt,
          sampleRate,
          channels: "stereo",
          speed: 1.0,
          normalize: true
        });
        item.size = blob.size;
        item.downloadUrl = URL.createObjectURL(blob);
      } else if ((format === "png" || format === "webp") && item.file && item.file.type.startsWith("image/")) {
        const outBlob = await convertImageFile(item.file, format);
        item.size = outBlob.size;
        item.downloadUrl = URL.createObjectURL(outBlob);
      } else if (item.file && item.file.type.startsWith("audio/")) {
        const arrayBuf = await item.file.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        const outBlob = audioBufferToWavBlob(decoded, sampleRate, false, true, 1.0);
        await audioCtx.close();
        item.size = outBlob.size;
        item.downloadUrl = URL.createObjectURL(outBlob);
      }
      item.status = "Completed";
    } catch (err) {
      item.status = "Error";
      showToast(`Gagal memproses ${item.name}: ${err.message || "Error"}`);
    }
    renderBulkTable();
  }

  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "Bulk Convert",
      action: `Batch Convert (${bulkQueue.length} files)`,
      detail: `Semua file dikonversi ke ${format.toUpperCase()} dengan prefix '${prefix}'`,
      status: "Success"
    })
  });
  if (res.ok) {
    const data = await res.json();
    appState.history.unshift(data.item);
    appState.apiUsage = data.apiUsage;
    renderAllViews();
  }
  showToast(`Bulk Convert selesai memproses ${bulkQueue.length} file.`);
});

// ==========================================
// 3. CHAT AI (SERVER-SIDE GEMINI)
// ==========================================
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatModeSelect = document.getElementById("chatModeSelect");

function appendChatBubble(role, text, label) {
  const div = document.createElement("div");
  div.className = `chat-bubble ${role === "user" ? "user" : "ai"}`;
  div.innerHTML = `
    <div class="bubble-header">
      <strong>${role === "user" ? "Kamu" : "Sakurayama AI"}</strong>
      <span>${label || (role === "user" ? "Developer" : "Gemini")}</span>
    </div>
    <div class="bubble-body"></div>
  `;
  div.querySelector(".bubble-body").textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function sendChatPrompt(messageText) {
  const text = messageText.trim();
  if (!text) return;

  appendChatBubble("user", text, "Workspace User");
  chatInput.value = "";
  const loadingBubble = appendChatBubble("ai", "Sedang menyusun jawaban...", "Memproses");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: chatHistory,
        mode: chatModeSelect.value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      loadingBubble.querySelector(".bubble-body").textContent = "Error: " + (data.error || "Gagal memproses permintaan.");
      return;
    }

    loadingBubble.querySelector(".bubble-body").textContent = data.reply;
    loadingBubble.querySelector(".bubble-header span").textContent = chatModeSelect.value.toUpperCase();

    chatHistory.push({ role: "user", text });
    chatHistory.push({ role: "model", text: data.reply });

    if (data.apiUsage) {
      appState.apiUsage = data.apiUsage;
      fetchInitialState();
    }
  } catch (err) {
    loadingBubble.querySelector(".bubble-body").textContent = "Gagal menghubungi server AI: " + err.message;
  }
}

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  sendChatPrompt(chatInput.value);
});

document.querySelectorAll(".chat-preset-btn[data-prompt]").forEach(btn => {
  btn.addEventListener("click", () => {
    sendChatPrompt(btn.dataset.prompt);
  });
});

document.getElementById("clearChatBtn").addEventListener("click", () => {
  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="chat-bubble ai">
      <div class="bubble-header"><strong>Sakurayama AI</strong> <span>System</span></div>
      <div class="bubble-body">Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru seputar Luau atau Roblox Studio.</div>
    </div>
  `;
  showToast("Sesi percakapan di-reset.");
});

// ==========================================
// 4. ACTIVITY HISTORY
// ==========================================
const historyTableBody = document.getElementById("historyTableBody");
const historySearchInput = document.getElementById("historySearchInput");
const historyFilterSelect = document.getElementById("historyFilterSelect");

function renderHistoryTable() {
  if (!historyTableBody) return;
  const query = (historySearchInput?.value || "").toLowerCase();
  const toolFilter = historyFilterSelect?.value || "ALL";

  const filtered = appState.history.filter(item => {
    const matchTool = toolFilter === "ALL" || item.tool === toolFilter;
    const matchText =
      item.tool.toLowerCase().includes(query) ||
      item.action.toLowerCase().includes(query) ||
      (item.detail || "").toLowerCase().includes(query);
    return matchTool && matchText;
  });

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">Tidak ada riwayat aktivitas yang cocok.</td></tr>`;
    return;
  }

  historyTableBody.innerHTML = filtered.map(item => `
    <tr>
      <td class="mono-text">${formatTime(item.timestamp)}</td>
      <td><strong>${item.tool}</strong></td>
      <td>${item.action}</td>
      <td class="mono-text">${item.detail}</td>
      <td><span class="good">● ${item.status}</span></td>
    </tr>
  `).join("");
}

historySearchInput.addEventListener("input", renderHistoryTable);
historyFilterSelect.addEventListener("change", renderHistoryTable);

document.getElementById("exportHistoryBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(appState.history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakurayama_history_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Riwayat berhasil diunduh sebagai JSON.");
});

document.getElementById("clearHistoryBtn").addEventListener("click", async () => {
  const res = await fetch("/api/history", { method: "DELETE" });
  if (res.ok) {
    appState.history = [];
    renderAllViews();
    showToast("Seluruh riwayat aktivitas berhasil dihapus.");
  }
});

// ==========================================
// 5. ROBLOX SPOOFER (SINGLE & MASS 1,000+ AUTO-FILENAME)
// ==========================================
const spoofSpeed = document.getElementById("spoofSpeed");
const spoofSpeedVal = document.getElementById("spoofSpeedVal");
const spoofModeSingleBtn = document.getElementById("spoofModeSingleBtn");
const spoofModeMassBtn = document.getElementById("spoofModeMassBtn");
const spoofSingleInputGroup = document.getElementById("spoofSingleInputGroup");
const spoofMassInputGroup = document.getElementById("spoofMassInputGroup");
const spoofBatchList = document.getElementById("spoofBatchList");
const spoofMassCounter = document.getElementById("spoofMassCounter");
const massSpoofOutputSection = document.getElementById("massSpoofOutputSection");
const massSpoofTableBody = document.getElementById("massSpoofTableBody");

let currentSpoofMode = "single"; // "single" | "mass"
let lastMassSpoofItems = [];
let lastSingleSpoofResult = null;

function stripFileExt(filename) {
  return String(filename || "").replace(/\.[^/.]+$/, "").trim();
}

function detectAssetTypeFromExt(filename) {
  const ext = String(filename || "").split(".").pop().toLowerCase();
  if (["ogg", "wav", "mp3", "flac"].includes(ext)) return "Audio";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "Decal";
  if (["mesh", "obj", "fbx"].includes(ext)) return "Model";
  return "Animation";
}

spoofSpeed.addEventListener("input", () => {
  spoofSpeedVal.textContent = Number(spoofSpeed.value).toFixed(2) + "x";
});

function setSpoofMode(mode) {
  currentSpoofMode = mode;
  const isMass = mode === "mass";
  spoofModeSingleBtn.className = isMass ? "btn-secondary compact-btn" : "btn-primary compact-btn";
  spoofModeMassBtn.className = isMass ? "btn-primary compact-btn" : "btn-secondary compact-btn";
  spoofSingleInputGroup.classList.toggle("hidden", isMass);
  spoofMassInputGroup.classList.toggle("hidden", !isMass);
  document.getElementById("spoofNameLabel").textContent = isMass
    ? "Prefix Fallback (Jika baris tanpa nama file)"
    : "Nama Output Aset (Otomatis dari File)";
  document.getElementById("runSpoofBtn").textContent = isMass
    ? "Generate Mass Spoof (1.000+) & ModuleScript"
    : "Generate Spoofed Asset & Loader";
}

spoofModeSingleBtn.addEventListener("click", () => setSpoofMode("single"));
spoofModeMassBtn.addEventListener("click", () => setSpoofMode("mass"));

// Single file upload in Spoofer -> auto-fills Asset Name and Type
const spoofSingleFileInput = document.getElementById("spoofSingleFileInput");
document.getElementById("uploadSingleSpoofFileBtn").addEventListener("click", () => {
  spoofSingleFileInput.click();
});
spoofSingleFileInput.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const cleanName = stripFileExt(file.name);
  document.getElementById("spoofCustomName").value = cleanName;
  const detectedType = detectAssetTypeFromExt(file.name);
  if (detectedType === "Audio" || detectedType === "Animation") {
    document.getElementById("spoofAssetType").value = detectedType;
  }
  const digitsInName = cleanName.replace(/\D/g, "");
  if (digitsInName.length >= 6) {
    document.getElementById("spoofAssetId").value = `rbxassetid://${digitsInName}`;
  }
  showToast(`Nama aset otomatis disesuaikan dengan file: "${cleanName}"`);
});

// Mass file upload in Spoofer -> populates list with exact filenames
const spoofMassFilesInput = document.getElementById("spoofMassFilesInput");
document.getElementById("uploadMassSpoofFilesBtn").addEventListener("click", () => {
  spoofMassFilesInput.click();
});
spoofMassFilesInput.addEventListener("change", e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const lines = files.map((f, idx) => {
    const cleanName = stripFileExt(f.name);
    const digits = cleanName.replace(/\D/g, "");
    const origId = digits.length >= 6 ? digits : String(14800000000 + idx);
    return `${cleanName} : rbxassetid://${origId}`;
  });
  spoofBatchList.value = (spoofBatchList.value.trim() ? spoofBatchList.value.trim() + "\n" : "") + lines.join("\n");
  updateMassIdCount();
  showToast(`${files.length} file dimuat! Nama aset otomatis mengikuti nama masing-masing file.`);
});

function updateMassIdCount() {
  const raw = spoofBatchList.value || "";
  const count = raw.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean).length;
  spoofMassCounter.textContent = `${count.toLocaleString("id-ID")} item terdeteksi dalam daftar (Siap di-spoof sesuai namanya)`;
}

spoofBatchList.addEventListener("input", updateMassIdCount);

function generateSampleIds(count) {
  const samplePrefixes = ["Katana_Combo_Hit", "Sakura_Dash_Step", "Shrine_Guard_Block", "Dual_Blade_Spin", "Air_Finisher_Slash"];
  const list = [];
  for (let i = 0; i < count; i++) {
    const id = 14800000000 + Math.floor(Math.random() * 899999999);
    const pfx = samplePrefixes[i % samplePrefixes.length];
    list.push(`${pfx}_${String(i + 1).padStart(4, "0")} : rbxassetid://${id}`);
  }
  spoofBatchList.value = list.join("\n");
  updateMassIdCount();
  showToast(`${count.toLocaleString("id-ID")} Sample Aset beserta namanya berhasil dimasukkan!`);
}

document.getElementById("gen1000SpoofBtn").addEventListener("click", () => generateSampleIds(1000));

const spoofTxtFileInput = document.getElementById("spoofTxtFileInput");
document.getElementById("uploadSpoofTxtBtn").addEventListener("click", () => spoofTxtFileInput.click());
spoofTxtFileInput.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  spoofBatchList.value = text;
  updateMassIdCount();
  showToast(`Daftar dari '${file.name}' berhasil dimuat.`);
});

document.getElementById("spooferForm").addEventListener("submit", async e => {
  e.preventDefault();
  const badge = document.getElementById("spoofBadge");
  badge.textContent = "GENERATING...";

  if (currentSpoofMode === "mass") {
    const rawList = spoofBatchList.value.trim();
    if (!rawList) {
      generateSampleIds(1000);
    }

    const payload = {
      rawList: spoofBatchList.value,
      namePrefix: document.getElementById("spoofCustomName").value || "Sakura_Anim_",
      assetType: document.getElementById("spoofAssetType").value,
      rigType: document.getElementById("spoofRigType").value,
      priority: document.getElementById("spoofPriority").value,
      scaleSpeed: Number(spoofSpeed.value),
      loop: document.getElementById("spoofLoop").checked
    };

    try {
      const res = await fetch("/api/roblox/spoof-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal memproses Mass Spoof.");
        badge.textContent = "ERROR";
        return;
      }

      lastMassSpoofItems = data.items || [];
      document.getElementById("spoofKvLabel1").textContent = "Total Diproses";
      document.getElementById("spoofOutOrig").textContent = `${data.count.toLocaleString("id-ID")} Aset`;
      document.getElementById("spoofKvLabel2").textContent = "Sample URI Pertama";
      document.getElementById("spoofOutNew").textContent = lastMassSpoofItems[0]?.assetUri || "-";
      document.getElementById("spoofOutRig").textContent = `${data.rigType} · ${data.priority}`;
      document.getElementById("spoofOutHash").textContent = `BATCH-${data.count}-OK`;
      document.getElementById("spoofCodeBlock").textContent = data.luauSnippet;
      badge.textContent = `MASS SPOOFED (${data.count})`;

      massSpoofOutputSection.classList.remove("hidden");
      document.getElementById("massSpoofTableTitle").textContent =
        `Hasil Mass Spoof (${data.count.toLocaleString("id-ID")} Aset — Menampilkan 100 teratas, semua tersedia di Export)`;

      massSpoofTableBody.innerHTML = lastMassSpoofItems.slice(0, 100).map(item => `
        <tr>
          <td class="mono-text">${item.index}</td>
          <td><strong>${item.name}</strong></td>
          <td class="mono-text">${item.originalId}</td>
          <td class="mono-text gold-text">${item.assetUri}</td>
        </tr>
      `).join("");

      if (data.historyItem) appState.history.unshift(data.historyItem);
      if (data.apiUsage) appState.apiUsage = data.apiUsage;
      renderAllViews();
      showToast(`Sukses! ${data.count.toLocaleString("id-ID")} aset di-spoof sesuai nama masing-masing.`);
    } catch {
      badge.textContent = "ERROR";
      showToast("Terjadi kesalahan saat memproses Mass Spoof.");
    }
    return;
  }

  // Single Spoof Mode (includes uploaded file binary if user selected a file)
  const customName = document.getElementById("spoofCustomName").value.trim() || "Sakura_Dash_Strike";
  const singleSpoofFile = spoofSingleFileInput.files?.[0] || null;
  let spoofFileBase64 = null;
  let spoofFileName = null;
  let spoofMimeType = null;

  if (singleSpoofFile && singleSpoofFile.size <= 20 * 1024 * 1024) {
    try {
      const buf = await singleSpoofFile.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      spoofFileBase64 = btoa(binary);
      spoofFileName = singleSpoofFile.name;
      spoofMimeType = singleSpoofFile.type || "application/octet-stream";
    } catch {}
  }

  const payload = {
    assetId: document.getElementById("spoofAssetId").value,
    customName,
    assetType: document.getElementById("spoofAssetType").value,
    rigType: document.getElementById("spoofRigType").value,
    priority: document.getElementById("spoofPriority").value,
    scaleSpeed: Number(spoofSpeed.value),
    loop: document.getElementById("spoofLoop").checked,
    fileBase64: spoofFileBase64,
    fileName: spoofFileName,
    mimeType: spoofMimeType
  };

  try {
    const res = await fetch("/api/roblox/spoof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal melakukan spoofing.");
      badge.textContent = "ERROR";
      return;
    }

    lastSingleSpoofResult = {
      name: customName,
      type: payload.assetType,
      spoofedUri: data.assetUri
    };

    massSpoofOutputSection.classList.add("hidden");
    document.getElementById("spoofKvLabel1").textContent = "Nama Aset Output";
    document.getElementById("spoofOutOrig").textContent = customName;
    document.getElementById("spoofKvLabel2").textContent = "Spoofed Asset URI";
    document.getElementById("spoofOutNew").textContent = data.assetUri;
    document.getElementById("spoofOutRig").textContent = `${data.rigType} · ${data.priority}`;
    document.getElementById("spoofOutHash").textContent = data.uploadMode || data.signature;
    document.getElementById("spoofCodeBlock").textContent = data.luauSnippet;
    badge.textContent = data.liveUploaded ? "LIVE UPLOADED" : "LOCAL SIMULATED";

    if (data.historyItem) appState.history.unshift(data.historyItem);
    if (data.apiUsage) appState.apiUsage = data.apiUsage;
    renderAllViews();

    if (data.liveUploaded) {
      showToast(`Sukses masuk ke Inventori Roblox kamu! "${customName}" → ${data.assetUri}`);
    } else if (data.liveUploadError) {
      showToast(`Belum masuk ke Roblox: ${data.liveUploadError}`);
    } else {
      showToast(`Aset "${customName}" di-spoof lokal (${data.assetUri}). Isi Roblox Settings untuk Direct Upload.`);
    }
  } catch (err) {
    badge.textContent = "ERROR";
    showToast("Terjadi kesalahan koneksi.");
  }
});

// Send Spoofer results directly to Roblox Publishing with matching names
document.getElementById("sendSpoofToPublishBtn").addEventListener("click", () => {
  if (currentSpoofMode === "mass" && lastMassSpoofItems.length > 0) {
    setPublishMode("mass");
    document.getElementById("pubBatchList").value = lastMassSpoofItems.map(i => i.name).join("\n");
    updatePubMassCount();
    navigate("Roblox Publishing");
    showToast(`${lastMassSpoofItems.length} nama aset dari Spoofer siap di-publish!`);
  } else {
    setPublishMode("single");
    const nameVal = document.getElementById("spoofCustomName").value.trim() || "Sakura_Dash_Strike";
    document.getElementById("pubName").value = nameVal;
    document.getElementById("pubType").value = document.getElementById("spoofAssetType").value;
    navigate("Roblox Publishing");
    showToast(`Aset "${nameVal}" diteruskan ke Roblox Publishing.`);
  }
});

document.getElementById("copyAllSpoofedIdsBtn").addEventListener("click", () => {
  if (!lastMassSpoofItems.length) return;
  const text = lastMassSpoofItems.map(i => `${i.name} : ${i.assetUri}`).join("\n");
  navigator.clipboard.writeText(text);
  showToast(`${lastMassSpoofItems.length.toLocaleString("id-ID")} Nama & Spoofed URI berhasil disalin!`);
});

document.getElementById("exportSpoofCsvBtn").addEventListener("click", () => {
  if (!lastMassSpoofItems.length) return;
  const header = "Index,Name,OriginalId,SpoofedId,SpoofedUri\n";
  const rows = lastMassSpoofItems.map(i => `${i.index},"${i.name}",${i.originalId},${i.spoofedId},${i.assetUri}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakurayama_mass_spoof_${lastMassSpoofItems.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`File CSV (${lastMassSpoofItems.length} aset) berhasil diunduh.`);
});

document.getElementById("exportSpoofJsonBtn").addEventListener("click", () => {
  if (!lastMassSpoofItems.length) return;
  const blob = new Blob([JSON.stringify(lastMassSpoofItems, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakurayama_mass_spoof_${lastMassSpoofItems.length}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`File JSON (${lastMassSpoofItems.length} aset) berhasil diunduh.`);
});

document.getElementById("copySpoofIdBtn").addEventListener("click", () => {
  const uri = document.getElementById("spoofOutNew").textContent;
  navigator.clipboard.writeText(uri);
  showToast(`Disalin: ${uri}`);
});

document.getElementById("copySpoofCodeBtn").addEventListener("click", () => {
  const code = document.getElementById("spoofCodeBlock").textContent;
  navigator.clipboard.writeText(code);
  showToast("Luau Script Loader berhasil disalin ke clipboard.");
});

// ==========================================
// 6. ROBLOX PUBLISHING (SINGLE & MASS 1,000+ AUTO-FILENAME)
// ==========================================
const pubModeSingleBtn = document.getElementById("pubModeSingleBtn");
const pubModeMassBtn = document.getElementById("pubModeMassBtn");
const pubSingleGroup = document.getElementById("pubSingleGroup");
const pubSingleNameGroup = document.getElementById("pubSingleNameGroup");
const pubMassGroup = document.getElementById("pubMassGroup");
const pubBatchList = document.getElementById("pubBatchList");
const pubMassCounter = document.getElementById("pubMassCounter");
const pubFile = document.getElementById("pubFile");
const pubName = document.getElementById("pubName");
const pubType = document.getElementById("pubType");

let currentPublishMode = "single"; // "single" | "mass"
let selectedMassPubFilesMap = new Map();

function setPublishMode(mode) {
  currentPublishMode = mode;
  const isMass = mode === "mass";
  pubModeSingleBtn.className = isMass ? "btn-secondary compact-btn" : "btn-primary compact-btn";
  pubModeMassBtn.className = isMass ? "btn-primary compact-btn" : "btn-secondary compact-btn";
  pubSingleGroup.classList.toggle("hidden", isMass);
  pubSingleNameGroup.classList.toggle("hidden", isMass);
  pubMassGroup.classList.toggle("hidden", !isMass);
  document.getElementById("publishSubmitBtn").textContent = isMass
    ? "Publish Semua ke Roblox Cloud (Sesuai Nama File)"
    : "Publish ke Roblox Cloud";
}

pubModeSingleBtn.addEventListener("click", () => setPublishMode("single"));
pubModeMassBtn.addEventListener("click", () => setPublishMode("mass"));

// Auto-fill asset name and asset type when single file is selected in Publishing
pubFile.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const cleanName = stripFileExt(file.name);
  pubName.value = cleanName;
  pubType.value = detectAssetTypeFromExt(file.name);
  showToast(`Nama aset otomatis diisi sesuai nama file: "${cleanName}"`);
});

// Mass file selection in Publishing -> populates list with exact filenames and stores File references
const pubMassFilesInput = document.getElementById("pubMassFilesInput");
document.getElementById("uploadMassPubFilesBtn").addEventListener("click", () => {
  pubMassFilesInput.click();
});
pubMassFilesInput.addEventListener("change", e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  files.forEach(f => {
    selectedMassPubFilesMap.set(stripFileExt(f.name), f);
  });
  const names = files.map(f => stripFileExt(f.name));
  pubBatchList.value = (pubBatchList.value.trim() ? pubBatchList.value.trim() + "\n" : "") + names.join("\n");
  pubType.value = detectAssetTypeFromExt(files[0].name);
  updatePubMassCount();
  showToast(`${files.length} file dipilih! Semua akan di-publish sesuai nama file masing-masing.`);
});

function updatePubMassCount() {
  const lines = (pubBatchList.value || "").split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  pubMassCounter.textContent = `${lines.length.toLocaleString("id-ID")} file/aset siap di-publish sesuai namanya`;
}

pubBatchList.addEventListener("input", updatePubMassCount);

document.getElementById("gen1000PubSampleBtn").addEventListener("click", () => {
  const sampleNames = ["Katana_M1_Swing", "Katana_M2_Heavy", "Sakura_Step_SFX", "Shrine_Gate_Open", "Boss_Roar_Intro"];
  const lines = [];
  for (let i = 0; i < 1000; i++) {
    const base = sampleNames[i % sampleNames.length];
    lines.push(`${base}_${String(i + 1).padStart(4, "0")}.rbxm`);
  }
  pubBatchList.value = lines.join("\n");
  updatePubMassCount();
  showToast("1.000 sample nama file berhasil dimuat untuk Mass Publish!");
});

function renderPublishedTable() {
  const tbody = document.getElementById("publishedTableBody");
  const badge = document.getElementById("publishedCountBadge");
  if (!tbody) return;

  const total = appState.publishedAssets.length;
  badge.textContent = `${total.toLocaleString("id-ID")} ASSETS`;

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">Belum ada aset yang dipublikasikan.</td></tr>`;
    return;
  }

  // Render top 100 in DOM table for smooth scrolling, full list available via Copy/CSV
  tbody.innerHTML = appState.publishedAssets.slice(0, 100).map(asset => `
    <tr>
      <td class="mono-text gold-text">rbxassetid://${asset.id}</td>
      <td><strong>${asset.name}</strong><br><small class="muted-text">${asset.type} · ${asset.status || "Published"}</small></td>
      <td class="mono-text">${asset.creatorType} #${asset.creatorId}</td>
      <td style="text-align:right;">
        <button type="button" class="btn-secondary compact-btn manage-perm-btn" data-id="${asset.id}">Permission →</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".manage-perm-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("permAssetIdInput").value = btn.dataset.id;
      inspectPermission(btn.dataset.id);
      navigate("Roblox Asset Permission");
    });
  });
}

document.getElementById("publishForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (currentPublishMode === "mass") {
    let lines = (pubBatchList.value || "").split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      document.getElementById("gen1000PubSampleBtn").click();
      lines = (pubBatchList.value || "").split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
    }

    const items = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const cleanName = stripFileExt(line.split(/[:|,]/)[0]);
      const detectedType = line.includes(".") ? detectAssetTypeFromExt(line) : pubType.value;
      const itemObj = { name: cleanName, type: detectedType };

      // Attach file binary for up to 25 files so Mass Publish can upload directly to Roblox Inventory
      const matchedFile = selectedMassPubFilesMap.get(cleanName);
      if (matchedFile && idx < 25 && matchedFile.size <= 10 * 1024 * 1024) {
        try {
          const buf = await matchedFile.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let b = 0; b < bytes.byteLength; b++) {
            binary += String.fromCharCode(bytes[b]);
          }
          itemObj.fileBase64 = btoa(binary);
          itemObj.fileName = matchedFile.name;
          itemObj.mimeType = matchedFile.type || "application/octet-stream";
        } catch {}
      }
      items.push(itemObj);
    }

    const res = await fetch("/api/roblox/publish-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        type: pubType.value,
        creatorType: document.getElementById("pubCreatorType").value,
        creatorId: document.getElementById("pubCreatorId").value,
        description: document.getElementById("pubDesc").value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal melakukan Mass Publish.");
      return;
    }

    appState.publishedAssets = [...data.assets, ...appState.publishedAssets].slice(0, 2000);
    if (data.historyItem) appState.history.unshift(data.historyItem);
    if (data.apiUsage) appState.apiUsage = data.apiUsage;
    renderAllViews();

    if (data.lastLiveError && !data.liveSuccessCount) {
      showToast(`Perhatian: ${data.lastLiveError}`);
    } else if (data.liveSuccessCount > 0) {
      showToast(`Sukses! ${data.liveSuccessCount} file berhasil masuk ke Inventori Roblox kamu!`);
    } else {
      showToast(`${data.count.toLocaleString("id-ID")} aset diproses. Untuk masuk ke Inventori Roblox, pastikan pilih file asli & isi Roblox Settings.`);
    }
    return;
  }

  // Single Publish (includes actual file bytes for Direct Roblox Open Cloud / Cookie Upload)
  let finalName = pubName.value.trim();
  const uploadedFile = pubFile.files?.[0] || null;
  if (!finalName && uploadedFile) {
    finalName = stripFileExt(uploadedFile.name);
    pubName.value = finalName;
  }
  if (!finalName) {
    finalName = "Sakura_Uploaded_Asset";
    pubName.value = finalName;
  }

  let fileBase64 = null;
  let fileName = null;
  let mimeType = null;

  if (uploadedFile && uploadedFile.size <= 20 * 1024 * 1024) {
    try {
      const buf = await uploadedFile.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileBase64 = btoa(binary);
      fileName = uploadedFile.name;
      mimeType = uploadedFile.type || "application/octet-stream";
    } catch {}
  }

  const submitBtn = document.getElementById("publishSubmitBtn");
  const prevBtnText = submitBtn.textContent;
  submitBtn.textContent = "Mengunggah ke Server Roblox...";
  submitBtn.disabled = true;

  try {
    const payload = {
      name: finalName,
      type: pubType.value,
      creatorType: document.getElementById("pubCreatorType").value,
      creatorId: document.getElementById("pubCreatorId").value,
      description: document.getElementById("pubDesc").value || `Uploaded file: ${finalName}`,
      fileBase64,
      fileName,
      mimeType
    };

    const res = await fetch("/api/roblox/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal mempublikasikan aset ke Roblox.");
      return;
    }

    appState.publishedAssets.unshift(data.asset);
    if (data.historyItem) appState.history.unshift(data.historyItem);
    if (data.apiUsage) appState.apiUsage = data.apiUsage;
    pubName.value = "";
    pubFile.value = "";
    document.getElementById("pubDesc").value = "";
    renderAllViews();
    showToast(`Sukses masuk ke Inventori Roblox! "${data.asset.name}" → rbxassetid://${data.asset.id}`);
  } finally {
    submitBtn.textContent = prevBtnText;
    submitBtn.disabled = false;
  }
});

document.getElementById("copyAllPubIdsBtn").addEventListener("click", () => {
  if (!appState.publishedAssets.length) return;
  const text = appState.publishedAssets.map(a => `${a.name} : rbxassetid://${a.id}`).join("\n");
  navigator.clipboard.writeText(text);
  showToast(`${appState.publishedAssets.length.toLocaleString("id-ID")} Nama & Asset ID berhasil disalin!`);
});

document.getElementById("exportPubCsvBtn").addEventListener("click", () => {
  if (!appState.publishedAssets.length) return;
  const header = "AssetId,AssetUri,Name,Type,CreatorType,CreatorId\n";
  const rows = appState.publishedAssets.map(
    a => `${a.id},rbxassetid://${a.id},"${a.name}",${a.type},${a.creatorType},${a.creatorId}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakurayama_published_assets_${appState.publishedAssets.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`CSV (${appState.publishedAssets.length} aset terpublikasi) berhasil diunduh.`);
});

// ==========================================
// 7. ROBLOX ASSET PERMISSION
// ==========================================
let currentInspectedAssetId = "98410293841";

async function inspectPermission(assetId) {
  const cleanId = String(assetId).replace(/\D/g, "");
  if (!cleanId) {
    showToast("Masukkan Asset ID berupa angka.");
    return;
  }
  currentInspectedAssetId = cleanId;
  const res = await fetch(`/api/roblox/permissions/${cleanId}`);
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "Gagal memuat permission.");
    return;
  }
  if (data.apiUsage) appState.apiUsage = data.apiUsage;
  renderPermissionView(data.permission);
  renderHomeStats();
}

function renderPermissionView(perm) {
  if (!perm) return;
  document.getElementById("permDetailId").textContent = perm.assetId;
  document.getElementById("permDetailName").textContent = perm.name;
  document.getElementById("permDetailOwner").textContent = perm.owner;
  document.getElementById("permDetailVis").textContent = `${perm.visibility} (Whitelisted Places)`;

  const places = perm.authorizedPlaces || [];
  document.getElementById("permPlacesCount").textContent = `● ${places.length} Places`;

  const tbody = document.getElementById("permPlacesTableBody");
  if (places.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">Belum ada Place ID yang diberi akses untuk aset ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = places.map(p => `
    <tr>
      <td class="mono-text gold-text">${p.placeId}</td>
      <td><strong>${p.name}</strong><br><small class="muted-text">Added ${p.addedAt}</small></td>
      <td><span class="good">${p.access}</span></td>
      <td style="text-align:right;">
        <button type="button" class="btn-ghost compact-btn revoke-place-btn" data-place="${p.placeId}">Cabut Akses</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".revoke-place-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const placeId = btn.dataset.place;
      const res = await fetch(`/api/roblox/permissions/${currentInspectedAssetId}/revoke/${placeId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        if (data.historyItem) appState.history.unshift(data.historyItem);
        renderPermissionView(data.permission);
        renderHistoryTable();
        showToast(`Izin untuk Place ID ${placeId} telah dicabut.`);
      }
    });
  });
}

document.getElementById("permInspectForm").addEventListener("submit", e => {
  e.preventDefault();
  inspectPermission(document.getElementById("permAssetIdInput").value);
});

document.getElementById("permGrantForm").addEventListener("submit", async e => {
  e.preventDefault();
  const placeId = document.getElementById("grantPlaceId").value;
  const placeName = document.getElementById("grantPlaceName").value;

  const res = await fetch(`/api/roblox/permissions/${currentInspectedAssetId}/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, placeName, access: "Use & View" })
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "Gagal menambahkan Place ID.");
    return;
  }
  document.getElementById("grantPlaceId").value = "";
  document.getElementById("grantPlaceName").value = "";
  if (data.historyItem) appState.history.unshift(data.historyItem);
  if (data.apiUsage) appState.apiUsage = data.apiUsage;
  renderPermissionView(data.permission);
  renderAllViews();
  showToast(`Place ID ${placeId} berhasil diizinkan mengakses Asset #${currentInspectedAssetId}.`);
});

// ==========================================
// 8. ROBLOX SETTINGS
// ==========================================
function renderSettingsForm() {
  const s = appState.settings;
  if (!s) return;
  document.getElementById("setCreatorType").value = s.creatorType || "User";
  document.getElementById("setCreatorId").value = s.creatorId || "48291049";
  document.getElementById("setDefaultRig").value = s.defaultRig || "R15";
  document.getElementById("setDefaultPriority").value = s.defaultPriority || "Action";
  document.getElementById("setWebhookUrl").value = s.webhookUrl || "";
  document.getElementById("setAutoHistory").checked = Boolean(s.autoExportHistory);

  const keyInput = document.getElementById("setOpenCloudKey");
  const cookieInput = document.getElementById("setRobloxCookie");
  if (keyInput && s.openCloudKey) keyInput.value = s.openCloudKey;
  if (cookieInput && s.robloxCookie) cookieInput.value = s.robloxCookie;

  const userSuffix = s.verifiedUsername ? ` (@${s.verifiedUsername})` : "";
  document.getElementById("settingsSummaryCreator").textContent = `${s.creatorType} #${s.creatorId}${userSuffix}`;
  document.getElementById("settingsSummaryRig").textContent = `${s.defaultRig} · ${s.defaultPriority}`;
  const modeText = document.getElementById("settingsUploadModeText");
  const ocBadge = document.getElementById("settingsOpenCloudBadge");

  if (modeText) {
    if (s.hasOpenCloudKey && s.hasRobloxCookie) {
      modeText.textContent = "Aktif Penuh (Open Cloud API + Cookie Animation)";
    } else if (s.hasRobloxCookie) {
      modeText.textContent = "Cookie Aktif (Siap Upload Animation & Asset)";
    } else if (s.hasOpenCloudKey) {
      modeText.textContent = "Open Cloud API Aktif (Audio, Decal, Model)";
    } else {
      modeText.textContent = "Belum Diisi (Wajib Isi untuk Direct Upload)";
    }
  }
  if (ocBadge) {
    ocBadge.textContent = s.openCloudConnected ? "● Terhubung ke Roblox" : "● Belum Terhubung";
  }

  // Sync defaults to Publishing & Spoofer forms
  document.getElementById("pubCreatorType").value = s.creatorType;
  document.getElementById("pubCreatorId").value = s.creatorId;
  document.getElementById("spoofRigType").value = s.defaultRig;
  document.getElementById("spoofPriority").value = s.defaultPriority;
}

document.getElementById("robloxSettingsForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    creatorType: document.getElementById("setCreatorType").value,
    creatorId: document.getElementById("setCreatorId").value,
    openCloudKey: document.getElementById("setOpenCloudKey")?.value || "",
    robloxCookie: document.getElementById("setRobloxCookie")?.value || "",
    defaultRig: document.getElementById("setDefaultRig").value,
    defaultPriority: document.getElementById("setDefaultPriority").value,
    webhookUrl: document.getElementById("setWebhookUrl").value,
    autoExportHistory: document.getElementById("setAutoHistory").checked
  };

  const res = await fetch("/api/roblox/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (res.ok) {
    appState.settings = data.settings;
    if (data.historyItem) appState.history.unshift(data.historyItem);
    renderAllViews();
    if (data.settings.verifiedUsername) {
      showToast(`Tersimpan! Terhubung ke akun Roblox @${data.settings.verifiedUsername} (ID: ${data.settings.creatorId}).`);
    } else if (data.settings.openCloudConnected) {
      showToast(`Kredensial Roblox berhasil disimpan & siap Direct Upload ke ${data.settings.creatorType} #${data.settings.creatorId}!`);
    } else {
      showToast("Pengaturan disimpan, namun API Key / Cookie belum diisi.");
    }
  }
});

const verifyRobloxCredsBtn = document.getElementById("verifyRobloxCredsBtn");
if (verifyRobloxCredsBtn) {
  verifyRobloxCredsBtn.addEventListener("click", async () => {
    const prevText = verifyRobloxCredsBtn.textContent;
    verifyRobloxCredsBtn.textContent = "Mengecek ke Server Roblox...";
    verifyRobloxCredsBtn.disabled = true;

    try {
      const payload = {
        creatorType: document.getElementById("setCreatorType").value,
        creatorId: document.getElementById("setCreatorId").value,
        openCloudKey: document.getElementById("setOpenCloudKey")?.value || "",
        robloxCookie: document.getElementById("setRobloxCookie")?.value || ""
      };

      const res = await fetch("/api/roblox/verify-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal memverifikasi kredensial Roblox.");
        return;
      }

      if (data.detectedUser) {
        document.getElementById("setCreatorId").value = data.detectedUser.id;
        document.getElementById("pubCreatorId").value = data.detectedUser.id;
      }
      await fetchInitialState();
      showToast(data.message || "Verifikasi selesai.");
    } catch {
      showToast("Gagal menghubungi endpoint verifikasi Roblox.");
    } finally {
      verifyRobloxCredsBtn.textContent = prevText;
      verifyRobloxCredsBtn.disabled = false;
    }
  });
}

// ==========================================
// 9. API LIMITS & BUY PREMIUM
// ==========================================
function renderLimits() {
  const u = appState.apiUsage;
  if (!u) return;

  const setBar = (textId, barId, used, limit) => {
    const t = document.getElementById(textId);
    const b = document.getElementById(barId);
    if (t) t.textContent = `${used} / ${limit}`;
    if (b) b.style.width = Math.min(100, Math.round((used / Math.max(1, limit)) * 100)) + "%";
  };

  setBar("limConvText", "limConvBar", u.converterUsed, u.converterLimit);
  setBar("limBulkText", "limBulkBar", u.bulkUsed, u.bulkLimit);
  setBar("limAiText", "limAiBar", u.aiUsed, u.aiLimit);
  setBar("limRbxText", "limRbxBar", u.robloxUsed, u.robloxLimit);

  const limitsBadge = document.getElementById("limitsPlanBadge");
  if (limitsBadge) limitsBadge.textContent = `Paket: ${appState.plan}`;
}

document.getElementById("resetLimitsBtn").addEventListener("click", async () => {
  const res = await fetch("/api/limits/reset", { method: "POST" });
  const data = await res.json();
  if (res.ok) {
    appState.apiUsage = data.apiUsage;
    if (data.historyItem) appState.history.unshift(data.historyItem);
    renderAllViews();
    showToast("Indikator kuota harian berhasil di-reset ke 0.");
  }
});

function renderPlanSelection() {
  const currentPlan = appState.plan || "Creator+";
  const sidebarBadge = document.getElementById("sidebarPlanBadge");
  const topPlanText = document.getElementById("topPlanText");
  if (sidebarBadge) sidebarBadge.textContent = currentPlan;
  if (topPlanText) topPlanText.textContent = `${currentPlan} Active`;

  document.querySelectorAll(".select-plan-btn").forEach(btn => {
    const isCurrent = btn.dataset.plan === currentPlan;
    btn.textContent = isCurrent ? `Paket Aktif (${btn.dataset.plan})` : `Pilih ${btn.dataset.plan}`;
    btn.className = isCurrent ? "btn-primary select-plan-btn" : "btn-secondary select-plan-btn";
  });
}

document.querySelectorAll(".select-plan-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const plan = btn.dataset.plan;
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });
    const data = await res.json();
    if (res.ok) {
      appState.plan = data.plan;
      appState.apiUsage = data.apiUsage;
      if (data.historyItem) appState.history.unshift(data.historyItem);
      renderAllViews();
      showToast(`Paket workspace berhasil diubah ke ${plan}.`);
    }
  });
});

// Initialize permissions & state on boot
fetchInitialState().then(() => {
  inspectPermission("98410293841");
});

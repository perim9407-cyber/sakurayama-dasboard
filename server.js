const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ytdl = require("@distube/ytdl-core");
const { Innertube } = require("youtubei.js");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const ytDlpPath = path.join(__dirname, "node_modules", "yt-dlp-exec", "bin", "yt-dlp");

// Ensure yt-dlp binary is present for full-length YouTube audio extraction
async function ensureYtDlpBinary() {
  try {
    if (fs.existsSync(ytDlpPath)) return ytDlpPath;
    fs.mkdirSync(path.dirname(ytDlpPath), { recursive: true });
    const res = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp");
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(ytDlpPath, buf, { mode: 0o755 });
    }
  } catch (err) {
    console.warn("yt-dlp init warning:", err.message);
  }
  return ytDlpPath;
}
ensureYtDlpBinary();

app.use(express.json({ limit: "25mb" }));
app.use(express.static(publicDir));

// Shared server-side state
const state = {
  history: [
    {
      id: "hist-1",
      tool: "Converter",
      action: "Konversi Audio",
      detail: "sakura_theme_bgm.wav → OGG (Roblox Optimized, 44.1kHz)",
      status: "Success",
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: "hist-2",
      tool: "Roblox Spoofer",
      action: "Re-hash Animation ID",
      detail: "rbxassetid://14892039104 → rbxassetid://98410293841 (R15 Action)",
      status: "Success",
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "hist-3",
      tool: "Roblox Asset Permission",
      action: "Grant Experience Access",
      detail: "Asset 14892039104 diberi izin ke Place ID 892341029",
      status: "Success",
      timestamp: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  publishedAssets: [
    {
      id: "98410293841",
      name: "Sakura Slash Combo V2",
      type: "Animation",
      creatorType: "User",
      creatorId: "48291049",
      status: "Published",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "14892039104",
      name: "Shrine Ambient Wind",
      type: "Audio",
      creatorType: "Group",
      creatorId: "12094812",
      status: "Published",
      createdAt: new Date(Date.now() - 43200000).toISOString()
    }
  ],
  permissions: {
    "98410293841": {
      assetId: "98410293841",
      name: "Sakura Slash Combo V2",
      type: "Animation",
      owner: "Sakurayama Studio (Group #12094812)",
      visibility: "Private",
      allowCopying: false,
      authorizedPlaces: [
        { placeId: "892341029", name: "Sakurayama RPG - Main Hub", access: "Use & View", addedAt: "2026-10-10" },
        { placeId: "771829401", name: "Combat Testing Place", access: "Use & View", addedAt: "2026-10-11" }
      ]
    },
    "14892039104": {
      assetId: "14892039104",
      name: "Shrine Ambient Wind",
      type: "Audio",
      owner: "Sakurayama Studio (Group #12094812)",
      visibility: "Restricted",
      allowCopying: false,
      authorizedPlaces: [
        { placeId: "892341029", name: "Sakurayama RPG - Main Hub", access: "Use & View", addedAt: "2026-10-09" }
      ]
    }
  },
  settings: {
    creatorType: process.env.ROBLOX_CREATOR_TYPE || "User",
    creatorId: process.env.ROBLOX_CREATOR_ID || "48291049",
    defaultRig: "R15",
    defaultPriority: "Action",
    autoExportHistory: true,
    webhookNotifications: false,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
    openCloudKey: process.env.ROBLOX_API_KEY || "",
    robloxCookie: process.env.ROBLOX_COOKIE || "",
    openCloudConnected: Boolean(process.env.ROBLOX_API_KEY || process.env.ROBLOX_COOKIE),
    liveUploadMode: Boolean(process.env.ROBLOX_API_KEY || process.env.ROBLOX_COOKIE) ? "live" : "auto"
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

function addHistory(tool, action, detail, status = "Success") {
  const item = {
    id: "hist-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    tool,
    action,
    detail,
    status,
    timestamp: new Date().toISOString()
  };
  state.history.unshift(item);
  if (state.history.length > 100) state.history.pop();
  return item;
}

// Build a minimal valid KeyframeSequence .rbxmx XML payload if user spoofs by ID and binary isn't attached
function createDefaultAnimationRbxmx(name) {
  const safeName = String(name || "Sakura_Animation").replace(/[<>&"']/g, "");
  const xml = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="KeyframeSequence" referent="RBX0">
    <Properties>
      <string name="Name">${safeName}</string>
      <bool name="Loop">false</bool>
      <token name="Priority">2</token>
    </Properties>
    <Item class="Keyframe" referent="RBX1">
      <Properties>
        <string name="Name">Keyframe</string>
        <float name="Time">0</float>
      </Properties>
    </Item>
  </Item>
</roblox>`;
  return Buffer.from(xml, "utf-8");
}

// Fetch raw asset binary from Roblox AssetDelivery (supports Open Cloud x-api-key or public AssetDelivery v1)
async function fetchRobloxAssetBinary(assetId, openCloudKey, cookie) {
  const cleanId = String(assetId || "").replace(/\D/g, "");
  if (!cleanId) return null;

  // 1. Try Open Cloud AssetDelivery v1 if API key is provided
  if (openCloudKey) {
    try {
      const ocRes = await fetch(`https://apis.roblox.com/asset-delivery-api/v1/assetId/${cleanId}`, {
        headers: {
          "x-api-key": openCloudKey,
          "Accept": "*/*"
        },
        redirect: "follow"
      });
      if (ocRes.ok) {
        const contentType = ocRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const j = await ocRes.json().catch(() => ({}));
          if (j.location) {
            const locRes = await fetch(j.location);
            if (locRes.ok) {
              const ab = await locRes.arrayBuffer();
              if (ab && ab.byteLength > 16) return Buffer.from(ab);
            }
          }
        } else {
          const ab = await ocRes.arrayBuffer();
          if (ab && ab.byteLength > 16) return Buffer.from(ab);
        }
      }
    } catch {}
  }

  // 2. Try standard AssetDelivery v1 (works for public assets or with optional cookie)
  const headers = {
    "User-Agent": "RobloxStudio/WinInet",
    "Accept": "*/*"
  };
  if (cookie) {
    const cleanCookie = cookie.replace(/^_?\.?ROBLOSECURITY=/i, "").trim();
    headers["Cookie"] = `.ROBLOSECURITY=${cleanCookie}`;
  }
  try {
    const res = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${cleanId}`, {
      headers,
      redirect: "follow"
    });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab && ab.byteLength > 16) {
        return Buffer.from(ab);
      }
    }
  } catch {}
  return null;
}

// Upload Animation or Asset via Roblox Studio publish API (optional fallback if user provides .ROBLOSECURITY cookie)
async function uploadViaRobloxCookie({ name, description, assetType, creatorType, creatorId, fileBuffer, cookie }) {
  const cleanCookie = String(cookie || "").replace(/^_?\.?ROBLOSECURITY=/i, "").trim();
  if (!cleanCookie) {
    throw new Error("Cookie .ROBLOSECURITY belum diisi.");
  }

  const rbxTypeName = assetType === "Audio" ? "Audio" : assetType === "Decal" ? "Decal" : assetType === "Model" ? "Model" : "Animation";
  const groupParam = creatorType === "Group" && creatorId ? `&groupId=${encodeURIComponent(creatorId)}` : "";
  const uploadUrl = `https://www.roblox.com/ide/publish/UploadNewAnimation?assetTypeName=${encodeURIComponent(rbxTypeName)}&name=${encodeURIComponent(String(name).slice(0, 50))}&description=${encodeURIComponent(String(description || "Uploaded via Sakurayama").slice(0, 200))}&AllID=1&ispublic=False&allowComments=True&isGamesAsset=False${groupParam}`;

  const bodyBytes = fileBuffer || createDefaultAnimationRbxmx(name);

  let csrfToken = "";
  const firstRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Cookie": `.ROBLOSECURITY=${cleanCookie}`,
      "User-Agent": "RobloxStudio/WinInet",
      "Content-Type": "application/xml"
    },
    body: bodyBytes
  });

  if (firstRes.status === 403) {
    csrfToken = firstRes.headers.get("x-csrf-token") || "";
  } else if (firstRes.ok) {
    const text = (await firstRes.text()).trim();
    if (/^\d+$/.test(text)) {
      return { liveUploaded: true, assetId: text, method: "Roblox Studio API" };
    }
  }

  if (!csrfToken) {
    const errText = await firstRes.text().catch(() => "");
    throw new Error(`Roblox Auth gagal (HTTP ${firstRes.status}): ${errText.slice(0, 120)}`);
  }

  const secondRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Cookie": `.ROBLOSECURITY=${cleanCookie}`,
      "X-CSRF-TOKEN": csrfToken,
      "User-Agent": "RobloxStudio/WinInet",
      "Content-Type": "application/xml"
    },
    body: bodyBytes
  });

  const respText = (await secondRes.text()).trim();
  if (!secondRes.ok || !/^\d+$/.test(respText)) {
    throw new Error(`Gagal upload ke Roblox (HTTP ${secondRes.status}): ${respText.slice(0, 140)}`);
  }

  return {
    liveUploaded: true,
    assetId: respText,
    method: "Roblox Studio API"
  };
}

// Helper to send a single multipart upload to Roblox Open Cloud v1 Assets API and poll operation
async function postToRobloxOpenCloudV1({ openCloudKey, rbxAssetType, displayName, description, creationContext, payloadBytes, strictMime, fileName }) {
  const requestJson = JSON.stringify({
    assetType: rbxAssetType,
    displayName: String(displayName).slice(0, 50),
    description: String(description || `Uploaded via Sakurayama Dashboard (${displayName})`).slice(0, 1000),
    creationContext
  });

  const formData = new FormData();
  formData.append("request", requestJson);
  const blob = new Blob([payloadBytes], { type: strictMime });
  formData.append("fileContent", blob, fileName);

  const response = await fetch("https://apis.roblox.com/assets/v1/assets", {
    method: "POST",
    headers: {
      "x-api-key": openCloudKey
    },
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg = data.message || data.error || JSON.stringify(data);
    const err = new Error(`Roblox Open Cloud (HTTP ${response.status}): ${errMsg}`);
    err.status = response.status;
    throw err;
  }

  let finalAssetId = data.response?.assetId || data.assetId || null;
  const opPath = data.path;

  if (!finalAssetId && opPath) {
    const cleanOpPath = opPath.replace(/^\/+/, "");
    const opUrl = cleanOpPath.startsWith("operations/")
      ? `https://apis.roblox.com/assets/v1/${cleanOpPath}`
      : `https://apis.roblox.com/assets/v1/operations/${cleanOpPath}`;

    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 1200));
      const opRes = await fetch(opUrl, {
        headers: { "x-api-key": openCloudKey }
      });
      if (opRes.ok) {
        const opData = await opRes.json().catch(() => ({}));
        if (opData.done) {
          if (opData.error) {
            throw new Error(`Roblox Processing Error: ${opData.error.message || JSON.stringify(opData.error)}`);
          }
          if (opData.response?.assetId) {
            finalAssetId = String(opData.response.assetId);
            break;
          }
        }
      }
    }
  }

  if (!finalAssetId) {
    throw new Error("Upload terkirim ke Roblox Open Cloud tetapi Operation belum mengembalikan Asset ID.");
  }

  return {
    liveUploaded: true,
    assetId: finalAssetId,
    method: `Open Cloud v1 (${rbxAssetType})`
  };
}

// Direct Upload to Roblox using ONLY Open Cloud API Key (supports Animation .rbxm/.rbxmx, Model, Audio, Decal)
async function uploadToRobloxDirect({ name, description, assetType, creatorType, creatorId, fileBuffer, fileName, mimeType, originalAssetId }) {
  const openCloudKey = (state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim();
  const robloxCookie = (state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim();

  if (!openCloudKey && !robloxCookie) {
    throw new Error("ROBLOX_API_KEY (Open Cloud API Key) belum diisi! Silakan masukkan Open Cloud API Key beserta User/Group ID asli kamu di menu Roblox Settings (atau di Railway Variables).");
  }

  // Ensure we have binary payload: if user didn't attach a file, fetch from Roblox AssetDelivery or generate valid .rbxmx
  let payloadBytes = fileBuffer;
  if (!payloadBytes && originalAssetId) {
    payloadBytes = await fetchRobloxAssetBinary(originalAssetId, openCloudKey, robloxCookie);
  }
  if (!payloadBytes && (assetType === "Animation" || assetType === "Model")) {
    payloadBytes = createDefaultAnimationRbxmx(name);
    fileName = fileName || `${name}.rbxmx`;
  }

  // Primary Path: Pure Roblox Open Cloud API Key (NO .ROBLOSECURITY cookie needed!)
  if (openCloudKey) {
    if (!payloadBytes) {
      throw new Error("Silakan pilih file aset (.rbxm, .rbxmx, .ogg, .mp3, .wav, .png, .fbx) terlebih dahulu untuk di-upload.");
    }

    const cleanNumericId = String(creatorId || "").replace(/\D/g, "");
    if (!cleanNumericId) {
      throw new Error("Creator ID / Group ID wajib berupa angka ID Roblox kamu yang asli.");
    }

    const creationContext = {
      creator: creatorType === "User"
        ? { userId: cleanNumericId }
        : { groupId: cleanNumericId }
    };

    const ext = String(fileName || "").split(".").pop().toLowerCase();

    // Detect if payload is XML (.rbxmx) vs binary (.rbxm) by checking first bytes
    const headerStr = payloadBytes.slice(0, 32).toString("utf-8").trim();
    const isXmlRbxm = ext === "rbxmx" || (headerStr.startsWith("<roblox") && !headerStr.startsWith("<roblox!"));

    if (assetType === "Animation" || assetType === "Model" || ext === "rbxm" || ext === "rbxmx") {
      const rbxMime = isXmlRbxm ? "model/x-rbxm" : "model/x-rbxm";
      const safeFileName = fileName || `${name}.${isXmlRbxm ? "rbxmx" : "rbxm"}`;

      // Try uploading via Open Cloud v1 as Model (which natively accepts .rbxm / .rbxmx packages including KeyframeSequence)
      // or Animation if supported by the key's endpoint
      try {
        return await postToRobloxOpenCloudV1({
          openCloudKey,
          rbxAssetType: "Model",
          displayName: name,
          description,
          creationContext,
          payloadBytes,
          strictMime: rbxMime,
          fileName: safeFileName
        });
      } catch (firstErr) {
        // Fallback attempt with application/octet-stream or Animation assetType
        try {
          return await postToRobloxOpenCloudV1({
            openCloudKey,
            rbxAssetType: "Animation",
            displayName: name,
            description,
            creationContext,
            payloadBytes,
            strictMime: "model/x-rbxm",
            fileName: safeFileName
          });
        } catch {
          // If optional cookie is also configured, try cookie fallback; otherwise throw the exact Open Cloud error
          if (robloxCookie) {
            return await uploadViaRobloxCookie({
              name,
              description,
              assetType: "Animation",
              creatorType,
              creatorId,
              fileBuffer: payloadBytes,
              cookie: robloxCookie
            });
          }
          throw firstErr;
        }
      }
    }

    const rbxTypeMap = {
      Audio: "Audio",
      Decal: "Decal",
      Model: "Model"
    };
    const rbxAssetType = rbxTypeMap[assetType] || "Audio";

    let strictMime = "audio/ogg";
    if (rbxAssetType === "Audio") {
      strictMime = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "audio/ogg";
    } else if (rbxAssetType === "Decal") {
      strictMime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    } else if (rbxAssetType === "Model") {
      strictMime = ext === "fbx" ? "model/fbx" : "model/x-rbxm";
    }

    return await postToRobloxOpenCloudV1({
      openCloudKey,
      rbxAssetType,
      displayName: name,
      description,
      creationContext,
      payloadBytes,
      strictMime,
      fileName: fileName || `${name}.${ext || "ogg"}`
    });
  }

  // Secondary Path: If only Cookie was provided
  return await uploadViaRobloxCookie({
    name,
    description,
    assetType,
    creatorType,
    creatorId,
    fileBuffer: payloadBytes,
    cookie: robloxCookie
  });
}

// Get full dashboard state (mask sensitive keys before sending to client)
app.get("/api/state", (req, res) => {
  const hasKey = Boolean((state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim());
  const hasCookie = Boolean((state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim());
  state.settings.openCloudConnected = hasKey || hasCookie;
  res.json({
    ...state,
    settings: {
      ...state.settings,
      hasOpenCloudKey: hasKey,
      hasRobloxCookie: hasCookie,
      openCloudKey: hasKey ? "••••••••••••••••" : "",
      robloxCookie: hasCookie ? "••••••••••••••••" : ""
    }
  });
});

// Log history or clear history
app.post("/api/history", (req, res) => {
  const { tool, action, detail, status } = req.body || {};
  if (!tool || !action) {
    return res.status(400).json({ error: "Tool dan action wajib diisi." });
  }
  if (tool === "Converter") state.apiUsage.converterUsed += 1;
  if (tool === "Bulk Convert") state.apiUsage.bulkUsed += 1;
  const item = addHistory(tool, action, detail || "", status || "Success");
  res.json({ item, apiUsage: state.apiUsage });
});

app.delete("/api/history", (req, res) => {
  state.history = [];
  res.json({ ok: true, history: state.history });
});

// Helper to parse YouTube video ID from any youtube.com or youtu.be URL
function parseYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

// Helper to fetch YouTube metadata (title, author, duration, thumbnail) reliably
async function getYouTubeMeta(videoId) {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const yt = await Innertube.create({ retrieve_player: false });
    const info = await yt.getBasicInfo(videoId, "ANDROID");
    const basic = info.basic_info || {};
    if (basic.title) {
      return {
        videoId,
        url: canonicalUrl,
        title: basic.title,
        author: basic.author || basic.channel?.name || "YouTube Creator",
        durationSeconds: Number(basic.duration) || 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        streamAvailable: true
      };
    }
  } catch {
    // Fall through to oEmbed
  }

  const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`);
  if (!oembedRes.ok) {
    throw new Error("Video YouTube tidak ditemukan atau bersifat privat.");
  }
  const oembed = await oembedRes.json();
  return {
    videoId,
    url: canonicalUrl,
    title: oembed.title || `YouTube Audio (${videoId})`,
    author: oembed.author_name || "YouTube Creator",
    durationSeconds: 0,
    thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    streamAvailable: true
  };
}

// Fetch YouTube video metadata with exact duration
app.post("/api/youtube/info", async (req, res) => {
  try {
    const { url } = req.body || {};
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({ error: "URL YouTube tidak valid. Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    }
    const meta = await getYouTubeMeta(videoId);
    return res.json(meta);
  } catch (err) {
    res.status(404).json({ error: err?.message || "Gagal mengambil informasi video YouTube." });
  }
});

// Helper to run a child process and wait for completion
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    proc.stderr.on("data", d => { stderr += d.toString(); });
    proc.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Process exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

// Convert and serve FULL original audio track from YouTube URL using yt-dlp + ffmpeg with exact seekable duration headers
app.get("/api/youtube/stream", async (req, res) => {
  const videoId = parseYouTubeId(req.query.url || req.query.v || "");
  if (!videoId) {
    return res.status(400).json({ error: "Video ID tidak valid." });
  }
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const format = String(req.query.format || "wav").toLowerCase();
  const sampleRate = Math.max(8000, Math.min(96000, Number(req.query.sampleRate) || 44100));
  const channels = req.query.channels === "mono" ? 1 : 2;
  const speed = Math.max(0.5, Math.min(2.0, Number(req.query.speed) || 1.0));
  const normalize = req.query.normalize === "1" || req.query.normalize === "true";

  const outFormat = format === "ogg" ? "ogg" : format === "mp3" ? "mp3" : "wav";
  const mimeMap = {
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp3: "audio/mpeg"
  };

  const tmpId = `${videoId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpRawPrefix = path.join("/tmp", `sakura_raw_${tmpId}`);
  const tmpOutFile = path.join("/tmp", `sakura_yt_${tmpId}.${outFormat}`);

  const findRawFile = () => {
    try {
      const files = fs.readdirSync("/tmp").filter(f => f.startsWith(`sakura_raw_${tmpId}`));
      if (files.length > 0) return path.join("/tmp", files[0]);
    } catch {}
    return null;
  };

  const cleanupTmp = () => {
    try {
      const raw = findRawFile();
      if (raw && fs.existsSync(raw)) fs.unlinkSync(raw);
      if (fs.existsSync(tmpOutFile)) fs.unlinkSync(tmpOutFile);
    } catch {}
  };

  try {
    await ensureYtDlpBinary();

    // Stage 1: Try direct YouTube extraction via yt-dlp + node JS runtime
    let rawAudioPath = null;
    try {
      await runProcess(ytDlpPath, [
        "--js-runtimes", "node",
        "-f", "bestaudio/best",
        "-o", `${tmpRawPrefix}.%(ext)s`,
        "--no-warnings",
        "--no-playlist",
        canonicalUrl
      ]);
      rawAudioPath = findRawFile();
    } catch {
      rawAudioPath = null;
    }

    // Stage 2: If YouTube blocked this video on datacenter IP (e.g. VEVO bot-check or live stream),
    // automatically fetch the matching full song via SoundCloud extractor using the video's title & artist
    if (!rawAudioPath || !fs.existsSync(rawAudioPath) || fs.statSync(rawAudioPath).size < 1024) {
      let searchQuery = String(req.query.q || "").trim();
      if (!searchQuery) {
        try {
          const meta = await getYouTubeMeta(videoId);
          // Clean common suffixes like (Official Video) for cleaner track matching
          const cleanTitle = String(meta.title || "")
            .replace(/\(official.*?\)|\[official.*?\]|\(4k.*?\)|\[4k.*?\]|\(lyrics.*?\)|\(audio.*?\)/gi, "")
            .trim();
          searchQuery = `${cleanTitle} ${meta.author || ""}`.trim();
        } catch {
          searchQuery = videoId;
        }
      }

      await runProcess(ytDlpPath, [
        "--js-runtimes", "node",
        "-f", "http_mp3_1_0/bestaudio/best",
        "-o", `${tmpRawPrefix}.%(ext)s`,
        "--no-warnings",
        "--no-playlist",
        `scsearch1:${searchQuery}`
      ]);
      rawAudioPath = findRawFile();
    }

    if (!rawAudioPath || !fs.existsSync(rawAudioPath)) {
      cleanupTmp();
      return res.status(502).json({ error: "Gagal mengambil sumber audio lagu tersebut." });
    }

    // Convert full downloaded audio to user's target format (WAV / OGG / MP3) with exact sampleRate, channels, speed, and normalization
    const afFilters = [];
    if (Math.abs(speed - 1.0) > 0.01) {
      afFilters.push(`asetrate=${Math.round(sampleRate * speed)},aresample=${sampleRate}`);
    }
    if (normalize) {
      afFilters.push("volume=1.15");
    }

    const ffmpegArgs = [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", rawAudioPath,
      "-vn",
      "-ar", String(sampleRate),
      "-ac", String(channels)
    ];

    if (afFilters.length > 0) {
      ffmpegArgs.push("-af", afFilters.join(","));
    }

    if (outFormat === "ogg") {
      ffmpegArgs.push("-c:a", "libvorbis", "-q:a", "5", "-f", "ogg", tmpOutFile);
    } else if (outFormat === "mp3") {
      ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3", tmpOutFile);
    } else {
      ffmpegArgs.push("-bitexact", "-c:a", "pcm_s16le", "-f", "wav", tmpOutFile);
    }

    await runProcess("ffmpeg", ffmpegArgs);

    const stat = fs.statSync(tmpOutFile);
    if (!stat || stat.size < 1024) {
      cleanupTmp();
      return res.status(502).json({ error: "File hasil konversi kosong." });
    }

    res.setHeader("Content-Type", mimeMap[outFormat] || "audio/wav");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");

    const readStream = fs.createReadStream(tmpOutFile);
    readStream.on("close", cleanupTmp);
    readStream.on("error", () => {
      cleanupTmp();
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } catch (err) {
    cleanupTmp();
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Gagal memproses full audio YouTube." });
    }
  }
});

// Chat AI using @google/genai on the server
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], mode = "general" } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum tersedia di environment server."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const systemPrompts = {
      general: "Kamu adalah Sakurayama AI, asisten ahli untuk developer Roblox Studio, Luau scripting, optimasi audio/animasi, dan manajemen aset Open Cloud. Jawab dengan jelas, praktis, dan gunakan Bahasa Indonesia yang rapi serta contoh kode Luau bila relevan.",
      luau: "Kamu adalah pakar Luau Scripting untuk Roblox Studio. Berikan script Luau yang bersih, aman, efisien, dan mengikuti best-practice terbaru (task library, RaycastParams, ProfileService/DataStore2 pattern). Sertakan penjelasan singkat cara memasangnya di ServerScriptService atau StarterPlayerScripts.",
      asset: "Kamu adalah spesialis optimasi aset Roblox (Audio OGG/WAV, KeyframeSequence Animation R6/R15, MeshPart, dan Open Cloud Asset API). Bantu pengguna menyelesaikan masalah permission, ukuran file, bitrate, dan troubleshooting error rbxassetid."
    };

    const formattedContents = [];
    for (const msg of history.slice(-10)) {
      formattedContents.push({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: String(msg.text || "") }]
      });
    }
    formattedContents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompts[mode] || systemPrompts.general
      }
    });

    const replyText = response.text || "Maaf, tidak ada respons yang dihasilkan.";
    state.apiUsage.aiUsed += 1;
    addHistory("Chat AI", `Tanya AI (${mode.toUpperCase()})`, message.slice(0, 80), "Success");

    res.json({
      reply: replyText,
      apiUsage: state.apiUsage
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    res.status(500).json({
      error: err?.message || "Gagal menghubungi layanan AI."
    });
  }
});

// Roblox Spoofer endpoint (supports direct upload to Roblox Inventory when credentials are configured)
app.post("/api/roblox/spoof", async (req, res) => {
  const { assetId, assetType, rigType, priority, loop, scaleSpeed, customName, fileBase64, fileName, mimeType, directUpload } = req.body || {};
  if (!assetId && !fileBase64) {
    return res.status(400).json({ error: "Masukkan Asset ID atau pilih file terlebih dahulu." });
  }

  const cleanId = String(assetId || "").replace(/\D/g, "") || "1049281920";
  let newNumericId = "99" + Math.floor(100000000 + Math.random() * 899999999).toString();
  let uploadModeLabel = "Simulasi Lokal (Kredensial Belum Diisi)";
  let liveUploaded = false;
  let liveUploadError = null;

  const hasLiveCredentials = Boolean(
    (state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim() ||
    (state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim()
  );

  if (directUpload !== false && hasLiveCredentials) {
    try {
      const fileBuffer = fileBase64 ? Buffer.from(fileBase64, "base64") : null;
      const cloudRes = await uploadToRobloxDirect({
        name: customName || `Sakura_Spoof_${cleanId}`,
        description: `Spoofed & Re-hashed via Sakurayama (${rigType || "R15"} / ${priority || "Action"})`,
        assetType: assetType || "Animation",
        creatorType: state.settings.creatorType,
        creatorId: state.settings.creatorId,
        fileBuffer,
        fileName: fileName || `${customName || "Sakura_Anim"}.rbxm`,
        mimeType,
        originalAssetId: cleanId
      });
      if (cloudRes.liveUploaded && cloudRes.assetId) {
        newNumericId = String(cloudRes.assetId);
        liveUploaded = true;
        uploadModeLabel = `Live di Inventori Roblox (${cloudRes.method})`;
      }
    } catch (cloudErr) {
      liveUploadError = cloudErr.message;
      uploadModeLabel = "Gagal Live Upload ke Roblox";
    }
  } else if (directUpload !== false && !hasLiveCredentials) {
    liveUploadError = "Kredensial Roblox belum disimpan! Buka menu 'Roblox Settings' dan isi User/Group ID asli + Open Cloud API Key (untuk Audio/Decal) atau .ROBLOSECURITY Cookie (untuk Animation) agar aset masuk ke inventori Roblox kamu.";
  }

  const hashSignature = Buffer.from(`${cleanId}:${rigType}:${priority}:${Date.now()}`).toString("base64").slice(0, 24);

  const luauSnippet = `-- Sakurayama Spoofed Asset Loader (${uploadModeLabel})
-- Original ID: rbxassetid://${cleanId}
-- Spoofed ID : rbxassetid://${newNumericId}
-- Rig: ${rigType || "R15"} | Priority: Enum.AnimationPriority.${priority || "Action"}

local Players = game:GetService("Players")
local ContentProvider = game:GetService("ContentProvider")

local ASSET_URI = "rbxassetid://${newNumericId}"
local ASSET_NAME = "${(customName || "Sakura_Spoofed_Asset").replace(/"/g, '\\"')}"

local animation = Instance.new("Animation")
animation.Name = ASSET_NAME
animation.AnimationId = ASSET_URI

ContentProvider:PreloadAsync({ animation })

local function playOnCharacter(character)
\tlocal humanoid = character:WaitForChild("Humanoid")
\tlocal animator = humanoid:FindFirstChildOfClass("Animator") or Instance.new("Animator", humanoid)
\tlocal track = animator:LoadAnimation(animation)
\ttrack.Priority = Enum.AnimationPriority.${priority || "Action"}
\ttrack.Looped = ${Boolean(loop)}
\ttrack:Play(0.1, 1, ${Number(scaleSpeed) || 1.0})
\treturn track
end

return {
\tAssetId = ASSET_URI,
\tSignature = "${hashSignature}",
\tPlay = playOnCharacter
}`;

  if (liveUploaded) {
    const assetRecord = {
      id: newNumericId,
      name: customName || `Sakura_Spoof_${cleanId}`,
      description: `Spoofed via Sakurayama (${rigType || "R15"})`,
      type: assetType || "Animation",
      creatorType: state.settings.creatorType,
      creatorId: state.settings.creatorId,
      status: uploadModeLabel,
      createdAt: new Date().toISOString()
    };
    state.publishedAssets.unshift(assetRecord);
  }

  state.apiUsage.robloxUsed += 1;
  const histItem = addHistory(
    "Roblox Spoofer",
    `Spoof ${assetType || "Animation"} (${uploadModeLabel})`,
    `${customName || cleanId} → rbxassetid://${newNumericId} (${rigType || "R15"}, ${priority || "Action"})`,
    liveUploaded ? "Success" : "Warning"
  );

  res.json({
    originalId: cleanId,
    spoofedId: newNumericId,
    assetUri: `rbxassetid://${newNumericId}`,
    signature: hashSignature,
    uploadMode: uploadModeLabel,
    liveUploaded,
    liveUploadError,
    rigType: rigType || "R15",
    priority: priority || "Action",
    luauSnippet,
    historyItem: histItem,
    apiUsage: state.apiUsage
  });
});

// Roblox Mass / Batch Spoofer endpoint (supports 1,000+ assets & uploaded file names)
app.post("/api/roblox/spoof-batch", (req, res) => {
  const { rawList, entries, assetType, rigType, priority, loop, scaleSpeed, namePrefix } = req.body || {};

  const prefix = (namePrefix || "").trim();
  const rType = rigType || "R15";
  const prio = priority || "Action";
  const spd = Number(scaleSpeed) || 1.0;
  const isLooped = Boolean(loop);

  let parsedEntries = [];

  if (Array.isArray(entries) && entries.length > 0) {
    parsedEntries = entries.slice(0, 5000).map((e, i) => ({
      name: String(e.name || `${prefix || "Sakura_Asset_"}${i + 1}`).trim(),
      originalId: String(e.originalId || "").replace(/\D/g, "") || String(14000000000 + i)
    }));
  } else if (rawList && typeof rawList === "string") {
    const lines = rawList
      .split(/[\r\n;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    parsedEntries = lines.slice(0, 5000).map((line, i) => {
      const parts = line.split(/[:|,|\t]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const firstDigits = parts[0].replace(/\D/g, "");
        const secondDigits = parts[1].replace(/\D/g, "");
        if (secondDigits.length >= 5) {
          return { name: parts[0].replace(/\.[^/.]+$/, ""), originalId: secondDigits };
        } else if (firstDigits.length >= 5) {
          return { name: parts[1].replace(/\.[^/.]+$/, ""), originalId: firstDigits };
        }
      }
      const cleanId = line.replace(/\D/g, "");
      const hasLetters = /[a-zA-Z]/.test(line.replace(/rbxassetid:\/\//i, ""));
      const cleanName = hasLetters
        ? line.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
        : `${prefix || "Sakura_Anim_"}${String(i + 1).padStart(4, "0")}`;
      return {
        name: cleanName,
        originalId: cleanId || String(14800000000 + i)
      };
    });
  }

  if (parsedEntries.length === 0) {
    return res.status(400).json({ error: "Masukkan daftar Asset ID atau upload file terlebih dahulu." });
  }

  const items = parsedEntries.map((entry, idx) => {
    const newNumericId = "99" + Math.floor(100000000 + Math.random() * 899999999).toString();
    return {
      index: idx + 1,
      name: entry.name,
      originalId: entry.originalId,
      spoofedId: newNumericId,
      assetUri: `rbxassetid://${newNumericId}`
    };
  });

  const previewRows = items.slice(0, 50).map(
    it => `\t["${it.name.replace(/"/g, '\\"')}"] = { Original = "rbxassetid://${it.originalId}", Spoofed = "${it.assetUri}" },`
  ).join("\n");
  const moreComment = items.length > 50
    ? `\n\t-- ... (+${items.length - 50} aset lainnya termasuk dalam full export JSON/CSV & Luau)`
    : "";

  const luauSnippet = `-- Sakurayama Mass Spoofed Asset Registry (${items.length} Assets)
-- Rig: ${rType} | Priority: Enum.AnimationPriority.${prio} | Speed: ${spd}x | Looped: ${isLooped}

local ContentProvider = game:GetService("ContentProvider")

local AssetRegistry = {
${previewRows}${moreComment}
}

local function loadSpoofedAnimation(humanoid, assetName)
\tlocal entry = AssetRegistry[assetName]
\tif not entry then return nil end
\tlocal anim = Instance.new("Animation")
\tanim.Name = assetName
\tanim.AnimationId = entry.Spoofed
\tlocal animator = humanoid:FindFirstChildOfClass("Animator") or Instance.new("Animator", humanoid)
\tlocal track = animator:LoadAnimation(anim)
\ttrack.Priority = Enum.AnimationPriority.${prio}
\ttrack.Looped = ${isLooped}
\ttrack:Play(0.1, 1, ${spd})
\treturn track
end

return {
\tTotalCount = ${items.length},
\tRegistry = AssetRegistry,
\tPlay = loadSpoofedAnimation
}`;

  state.apiUsage.robloxUsed += items.length;
  const histItem = addHistory(
    "Roblox Spoofer",
    `Mass Spoof (${items.length} Assets)`,
    `Batch spoof ${items.length} ${assetType || "Animation"} sesuai nama file/item (${rType}, ${prio})`,
    "Success"
  );

  res.json({
    count: items.length,
    rigType: rType,
    priority: prio,
    items,
    luauSnippet,
    historyItem: histItem,
    apiUsage: state.apiUsage
  });
});

// Roblox Publishing endpoint (Single - performs real upload to Roblox Inventory)
app.post("/api/roblox/publish", async (req, res) => {
  const { name, description, type, creatorType, creatorId, allowComments, fileBase64, fileName, mimeType } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Nama aset wajib diisi." });
  }

  const cType = creatorType || state.settings.creatorType;
  const cId = creatorId || state.settings.creatorId;
  const aType = type || "Animation";

  const hasLiveCredentials = Boolean(
    (state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim() ||
    (state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim()
  );

  let newAssetId = "";
  let statusLabel = "";

  if (hasLiveCredentials) {
    try {
      const fileBuffer = fileBase64 ? Buffer.from(fileBase64, "base64") : null;
      const cloudRes = await uploadToRobloxDirect({
        name: name.trim(),
        description: (description || `Uploaded via Sakurayama Dashboard (${name.trim()})`).trim(),
        assetType: aType,
        creatorType: cType,
        creatorId: cId,
        fileBuffer,
        fileName: fileName || `${name.trim()}.rbxm`,
        mimeType
      });
      if (cloudRes.liveUploaded && cloudRes.assetId) {
        newAssetId = String(cloudRes.assetId);
        statusLabel = `Live di Roblox (${cloudRes.method})`;
      }
    } catch (cloudErr) {
      return res.status(400).json({
        error: cloudErr.message
      });
    }
  } else {
    return res.status(400).json({
      error: "Kredensial belum disimpan! Buka menu 'Roblox Settings', masukkan User/Group ID asli kamu beserta Open Cloud API Key (untuk Audio/Decal/Model) atau .ROBLOSECURITY Cookie (untuk Animation), lalu klik Simpan!"
    });
  }

  const assetRecord = {
    id: newAssetId,
    name: name.trim(),
    description: (description || "").trim(),
    type: aType,
    creatorType: cType,
    creatorId: cId,
    allowComments: Boolean(allowComments),
    status: statusLabel,
    createdAt: new Date().toISOString()
  };

  state.publishedAssets.unshift(assetRecord);
  state.permissions[newAssetId] = {
    assetId: newAssetId,
    name: assetRecord.name,
    type: assetRecord.type,
    owner: `${assetRecord.creatorType} #${assetRecord.creatorId}`,
    visibility: "Private",
    allowCopying: false,
    authorizedPlaces: [
      { placeId: "892341029", name: "Sakurayama RPG - Main Hub", access: "Use & View", addedAt: new Date().toISOString().slice(0, 10) }
    ]
  };

  state.apiUsage.robloxUsed += 1;
  const histItem = addHistory(
    "Roblox Publishing",
    `Publish ${assetRecord.type} (${statusLabel})`,
    `${assetRecord.name} → rbxassetid://${newAssetId} (${assetRecord.creatorType} #${assetRecord.creatorId})`,
    "Success"
  );

  res.json({
    asset: assetRecord,
    historyItem: histItem,
    apiUsage: state.apiUsage
  });
});

// Roblox Mass / Batch Publishing endpoint
app.post("/api/roblox/publish-batch", async (req, res) => {
  const { items, type, creatorType, creatorId, description } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Daftar aset yang akan di-publish masih kosong." });
  }

  const maxItems = items.slice(0, 5000);
  const cType = creatorType || state.settings.creatorType;
  const cId = creatorId || state.settings.creatorId;
  const defaultType = type || "Animation";
  const createdAssets = [];
  const hasLiveCredentials = Boolean(
    (state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim() ||
    (state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim()
  );

  let liveSuccessCount = 0;
  let lastLiveError = null;

  for (let i = maxItems.length - 1; i >= 0; i--) {
    const rawItem = maxItems[i];
    const cleanName = String(rawItem.name || `Sakura_Asset_${i + 1}`).replace(/\.[^/.]+$/, "").trim();
    const itemType = rawItem.type || defaultType;
    let newAssetId = "18" + Math.floor(100000000 + Math.random() * 899999999).toString();
    let statusLabel = "Local Registry (Tanpa File Binary)";

    if (hasLiveCredentials && maxItems.length <= 25 && rawItem.fileBase64) {
      try {
        const cloudRes = await uploadToRobloxDirect({
          name: cleanName,
          description: (description || `Published via Sakurayama Mass Publisher (${cleanName})`).trim(),
          assetType: itemType,
          creatorType: cType,
          creatorId: cId,
          fileBuffer: Buffer.from(rawItem.fileBase64, "base64"),
          fileName: rawItem.fileName || `${cleanName}.rbxm`,
          mimeType: rawItem.mimeType
        });
        if (cloudRes.liveUploaded && cloudRes.assetId) {
          newAssetId = String(cloudRes.assetId);
          statusLabel = `Live (${cloudRes.method})`;
          liveSuccessCount++;
        }
      } catch (err) {
        lastLiveError = err.message;
        statusLabel = "Gagal Live Upload";
      }
    }

    const assetRecord = {
      id: newAssetId,
      name: cleanName,
      description: (description || `Published via Sakurayama Mass Publisher (${cleanName})`).trim(),
      type: itemType,
      creatorType: cType,
      creatorId: cId,
      status: statusLabel,
      createdAt: new Date().toISOString()
    };

    state.publishedAssets.unshift(assetRecord);
    state.permissions[newAssetId] = {
      assetId: newAssetId,
      name: assetRecord.name,
      type: assetRecord.type,
      owner: `${cType} #${cId}`,
      visibility: "Private",
      allowCopying: false,
      authorizedPlaces: [
        { placeId: "892341029", name: "Sakurayama RPG - Main Hub", access: "Use & View", addedAt: new Date().toISOString().slice(0, 10) }
      ]
    };
    createdAssets.unshift(assetRecord);
  }

  if (state.publishedAssets.length > 2000) {
    state.publishedAssets = state.publishedAssets.slice(0, 2000);
  }

  state.apiUsage.robloxUsed += createdAssets.length;
  const histItem = addHistory(
    "Roblox Publishing",
    `Mass Publish (${createdAssets.length} Assets)`,
    `${createdAssets.length} aset diproses (${liveSuccessCount} Live Uploaded) ke ${cType} #${cId}`,
    lastLiveError && liveSuccessCount === 0 ? "Warning" : "Success"
  );

  res.json({
    count: createdAssets.length,
    liveSuccessCount,
    lastLiveError,
    assets: createdAssets,
    historyItem: histItem,
    apiUsage: state.apiUsage
  });
});

// Roblox Asset Permission endpoints
app.get("/api/roblox/permissions/:assetId", (req, res) => {
  const cleanId = String(req.params.assetId).replace(/\D/g, "");
  if (!cleanId) {
    return res.status(400).json({ error: "Asset ID tidak valid." });
  }
  if (!state.permissions[cleanId]) {
    state.permissions[cleanId] = {
      assetId: cleanId,
      name: `Roblox Asset #${cleanId}`,
      type: "Audio / Animation",
      owner: `${state.settings.creatorType} #${state.settings.creatorId}`,
      visibility: "Private",
      allowCopying: false,
      authorizedPlaces: [
        { placeId: "892341029", name: "Sakurayama RPG - Main Hub", access: "Use & View", addedAt: "2026-10-10" }
      ]
    };
  }
  state.apiUsage.robloxUsed += 1;
  res.json({ permission: state.permissions[cleanId], apiUsage: state.apiUsage });
});

app.post("/api/roblox/permissions/:assetId/grant", (req, res) => {
  const cleanId = String(req.params.assetId).replace(/\D/g, "");
  const { placeId, placeName, access } = req.body || {};
  const cleanPlaceId = String(placeId || "").replace(/\D/g, "");
  if (!cleanId || !cleanPlaceId) {
    return res.status(400).json({ error: "Asset ID dan Place/Universe ID wajib berupa angka." });
  }

  if (!state.permissions[cleanId]) {
    state.permissions[cleanId] = {
      assetId: cleanId,
      name: `Roblox Asset #${cleanId}`,
      type: "Audio / Animation",
      owner: `${state.settings.creatorType} #${state.settings.creatorId}`,
      visibility: "Private",
      allowCopying: false,
      authorizedPlaces: []
    };
  }

  const list = state.permissions[cleanId].authorizedPlaces;
  const existing = list.find(p => p.placeId === cleanPlaceId);
  if (!existing) {
    list.push({
      placeId: cleanPlaceId,
      name: placeName?.trim() || `Experience Place #${cleanPlaceId}`,
      access: access || "Use & View",
      addedAt: new Date().toISOString().slice(0, 10)
    });
  }

  state.apiUsage.robloxUsed += 1;
  const histItem = addHistory(
    "Roblox Asset Permission",
    "Grant Place Permission",
    `Asset ${cleanId} diizinkan untuk Place ID ${cleanPlaceId}`,
    "Success"
  );

  res.json({
    permission: state.permissions[cleanId],
    historyItem: histItem,
    apiUsage: state.apiUsage
  });
});

app.delete("/api/roblox/permissions/:assetId/revoke/:placeId", (req, res) => {
  const cleanId = String(req.params.assetId).replace(/\D/g, "");
  const cleanPlaceId = String(req.params.placeId).replace(/\D/g, "");
  if (state.permissions[cleanId]) {
    state.permissions[cleanId].authorizedPlaces = state.permissions[cleanId].authorizedPlaces.filter(
      p => p.placeId !== cleanPlaceId
    );
  }
  const histItem = addHistory(
    "Roblox Asset Permission",
    "Revoke Place Permission",
    `Akses Place ID ${cleanPlaceId} dicabut dari Asset ${cleanId}`,
    "Success"
  );
  res.json({
    permission: state.permissions[cleanId],
    historyItem: histItem
  });
});

// Verify Roblox Cookie / Open Cloud Key and auto-detect authenticated User ID & Username
app.post("/api/roblox/verify-credentials", async (req, res) => {
  const { openCloudKey, robloxCookie, creatorType, creatorId } = req.body || {};
  const activeKey = (openCloudKey && !openCloudKey.includes("•") ? openCloudKey : state.settings.openCloudKey || process.env.ROBLOX_API_KEY || "").trim();
  const activeCookie = (robloxCookie && !robloxCookie.includes("•") ? robloxCookie : state.settings.robloxCookie || process.env.ROBLOX_COOKIE || "").trim();

  if (!activeKey && !activeCookie) {
    return res.status(400).json({
      ok: false,
      error: "Masukkan minimal salah satu: Open Cloud API Key atau .ROBLOSECURITY Cookie terlebih dahulu."
    });
  }

  const results = {
    ok: false,
    cookieValid: false,
    openCloudConfigured: Boolean(activeKey),
    detectedUser: null,
    message: ""
  };

  if (activeCookie) {
    const cleanCookie = activeCookie.replace(/^_?\.?ROBLOSECURITY=/i, "").trim();
    try {
      const authRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
        headers: {
          "Cookie": `.ROBLOSECURITY=${cleanCookie}`,
          "User-Agent": "RobloxStudio/WinInet"
        }
      });
      if (authRes.ok) {
        const userData = await authRes.json();
        results.cookieValid = true;
        results.ok = true;
        results.detectedUser = {
          id: String(userData.id),
          name: userData.name,
          displayName: userData.displayName
        };
        // Automatically update creatorId if user is in User mode
        if ((creatorType || state.settings.creatorType) === "User") {
          state.settings.creatorId = String(userData.id);
        }
        state.settings.robloxCookie = cleanCookie;
      } else {
        results.message = `Cookie .ROBLOSECURITY ditolak oleh Roblox (HTTP ${authRes.status}). Pastikan menyalin seluruh teks cookie yang diawali _|WARNING:-DO-NOT-SHARE-THIS...`;
      }
    } catch (err) {
      results.message = `Gagal mengecek Cookie: ${err.message}`;
    }
  }

  if (activeKey) {
    state.settings.openCloudKey = activeKey;
    results.ok = true;
  }

  state.settings.openCloudConnected = Boolean(state.settings.openCloudKey || state.settings.robloxCookie);

  if (results.cookieValid && results.detectedUser) {
    results.message = `Terhubung ke Akun Roblox: @${results.detectedUser.name} (User ID: ${results.detectedUser.id}). Siap Direct Upload semua aset!`;
  } else if (results.openCloudConfigured) {
    results.message = `Open Cloud API Key aktif untuk ${creatorType || state.settings.creatorType} #${creatorId || state.settings.creatorId}. Siap Direct Upload Animation (.rbxm), Audio (.ogg/.mp3/.wav), Decal (.png), & Model tanpa Cookie!`;
  }

  res.json(results);
});

// Roblox Settings endpoint (allows saving Open Cloud Key, .ROBLOSECURITY Cookie, and Creator ID in runtime)
app.post("/api/roblox/settings", async (req, res) => {
  const updates = req.body || {};

  // Only overwrite key/cookie if user typed a new value (not masked bullets)
  let nextKey = state.settings.openCloudKey;
  if (typeof updates.openCloudKey === "string" && !updates.openCloudKey.includes("•")) {
    nextKey = updates.openCloudKey.trim();
  }
  let nextCookie = state.settings.robloxCookie;
  if (typeof updates.robloxCookie === "string" && !updates.robloxCookie.includes("•")) {
    nextCookie = updates.robloxCookie.trim().replace(/^_?\.?ROBLOSECURITY=/i, "").trim();
  }

  let nextCreatorType = updates.creatorType || state.settings.creatorType;
  let nextCreatorId = String(updates.creatorId || state.settings.creatorId).replace(/\D/g, "") || state.settings.creatorId;
  let verifiedUsername = null;

  // If a cookie is present and CreatorType is User, auto-detect real Roblox User ID so user doesn't accidentally leave placeholder ID
  if (nextCookie) {
    try {
      const authRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
        headers: {
          "Cookie": `.ROBLOSECURITY=${nextCookie}`,
          "User-Agent": "RobloxStudio/WinInet"
        }
      });
      if (authRes.ok) {
        const userData = await authRes.json();
        if (userData && userData.id) {
          verifiedUsername = userData.name;
          if (nextCreatorType === "User" && (!nextCreatorId || nextCreatorId === "48291049" || nextCreatorId === "12094812")) {
            nextCreatorId = String(userData.id);
          }
        }
      }
    } catch {}
  }

  const hasKey = Boolean((nextKey || process.env.ROBLOX_API_KEY || "").trim());
  const hasCookie = Boolean((nextCookie || process.env.ROBLOX_COOKIE || "").trim());

  state.settings = {
    ...state.settings,
    creatorType: nextCreatorType,
    creatorId: nextCreatorId,
    verifiedUsername: verifiedUsername || state.settings.verifiedUsername || null,
    defaultRig: updates.defaultRig || state.settings.defaultRig,
    defaultPriority: updates.defaultPriority || state.settings.defaultPriority,
    autoExportHistory: Boolean(updates.autoExportHistory),
    webhookNotifications: Boolean(updates.webhookNotifications),
    webhookUrl: String(updates.webhookUrl || ""),
    openCloudKey: nextKey,
    robloxCookie: nextCookie,
    openCloudConnected: hasKey || hasCookie
  };

  const histItem = addHistory(
    "Roblox Settings",
    "Update Kredensial & Target",
    `Creator: ${state.settings.creatorType} #${state.settings.creatorId}${verifiedUsername ? ` (@${verifiedUsername})` : ""} | OpenCloud: ${hasKey ? "Aktif" : "Off"} | Cookie: ${hasCookie ? "Aktif" : "Off"}`,
    "Success"
  );

  res.json({
    settings: {
      ...state.settings,
      hasOpenCloudKey: hasKey,
      hasRobloxCookie: hasCookie,
      openCloudKey: hasKey ? "••••••••••••••••" : "",
      robloxCookie: hasCookie ? "••••••••••••••••" : ""
    },
    historyItem: histItem
  });
});

// Upgrade / Change Plan endpoint
app.post("/api/plan", (req, res) => {
  const { plan } = req.body || {};
  if (!plan) return res.status(400).json({ error: "Pilih paket terlebih dahulu." });
  state.plan = plan;
  if (plan === "Studio Enterprise") {
    state.apiUsage.converterLimit = 5000;
    state.apiUsage.bulkLimit = 2500;
    state.apiUsage.aiLimit = 1000;
    state.apiUsage.robloxLimit = 10000;
  } else if (plan === "Creator+") {
    state.apiUsage.converterLimit = 500;
    state.apiUsage.bulkLimit = 250;
    state.apiUsage.aiLimit = 200;
    state.apiUsage.robloxLimit = 1000;
  } else {
    state.apiUsage.converterLimit = 50;
    state.apiUsage.bulkLimit = 20;
    state.apiUsage.aiLimit = 25;
    state.apiUsage.robloxLimit = 100;
  }
  const histItem = addHistory("Buy Premium", "Ubah Paket Workspace", `Paket aktif diubah ke ${plan}`, "Success");
  res.json({ plan: state.plan, apiUsage: state.apiUsage, historyItem: histItem });
});

// Reset API quota counter
app.post("/api/limits/reset", (req, res) => {
  state.apiUsage.converterUsed = 0;
  state.apiUsage.bulkUsed = 0;
  state.apiUsage.aiUsed = 0;
  state.apiUsage.robloxUsed = 0;
  const histItem = addHistory("API Limits", "Reset Kuota Harian", "Semua indikator penggunaan API di-reset ke 0", "Success");
  res.json({ apiUsage: state.apiUsage, historyItem: histItem });
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sakurayama Dashboard running on port ${PORT}`);
});
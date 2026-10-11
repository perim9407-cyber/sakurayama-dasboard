# Sakurayama Dashboard (Sakura Pink Edition)

All-in-one workspace untuk **Media Converter (YouTube Full Track & Local Audio/Image)**, **Bulk Convert**, **Sakurayama Chat AI (Gemini)**, **Roblox Spoofer (Single & Mass 1,000+ Assets)**, **Roblox Publishing**, dan **Roblox Asset Permission**.

## Fitur Utama

- **Media Converter & Bulk Convert**:
  - Konversi langsung dari **URL YouTube (Full Lagu)** maupun file lokal ke **WAV, OGG, MP3, PNG, WEBP, JPG**.
  - Pengaturan Sample Rate (`44.1 kHz`, `48 kHz`, `22.05 kHz`), Stereo/Mono, Pitch/Speed, dan Normalisasi Volume.
- **Roblox Spoofer & Roblox Publishing (Single & Mass 1.000+ File/ID)**:
  - Upload 1 atau ribuan file animasi/audio sekaligus; nama aset otomatis disesuaikan persis dengan nama file yang di-upload.
  - Export ke CSV, JSON, dan generator otomatis `AssetRegistry` ModuleScript Luau untuk Roblox Studio.
- **Chat AI (Sakurayama AI)**:
  - Asisten Luau Scripting, Optimasi Aset, dan Roblox Open Cloud berbasis `@google/genai`.

## Menjalankan Secara Lokal / Server (Railway / Render / VPS)

1. Pastikan **Node.js 18+** dan **ffmpeg** sudah terpasang di sistem.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env` (opsional untuk fitur Chat AI & Roblox Open Cloud):
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ROBLOX_API_KEY=your_roblox_open_cloud_key
   ```
4. Jalankan server:
   ```bash
   npm start
   ```
5. Buka `http://localhost:3000`.

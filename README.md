# Sakurayama Dashboard

Starter dashboard website inspired by the provided reference image. Built with Node.js and plain HTML/CSS/JavaScript so it can deploy on Railway without a build step.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this project folder.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deploy using GitHub and Railway

1. Extract this ZIP file.
2. Sign in to GitHub and create a new repository, for example `sakurayama-dashboard`.
3. Upload the contents of this folder to the repository root. Ensure `package.json`, `server.js`, `README.md`, and `public/` are at the root.
4. Sign in to Railway and choose **New Project** → **Deploy from GitHub repo**.
5. Select your `sakurayama-dashboard` repository and authorize access if prompted.
6. Railway detects Node.js and runs `npm start`. If asked for a start command, use `npm start`.
7. In the Railway service, open **Settings** → **Networking** (or **Public Networking**) and generate a domain.
8. Open the generated `https://...railway.app` domain to test the site.

## Important

This project is a visual starter, not a finished Roblox API integration. The dashboard navigation works, but converter, AI, publishing, permission checks, account settings, and premium billing need their own backend implementation. Do not put Roblox cookies, API keys, or other secrets in frontend JavaScript or commit them to GitHub. Use Railway Variables for server-side secrets, and only connect through authorized Roblox APIs and workflows.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = path.join(publicDir, urlPath === "/" ? "index.html" : urlPath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(publicDir, "index.html");
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end("Server error");
      }
      const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      });
      res.end(data);
    });
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Sakurayama Dashboard running on port ${PORT}`);
});
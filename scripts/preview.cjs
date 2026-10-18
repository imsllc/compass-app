/* global __dirname */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".css": "text/css",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    const candidate = path.resolve(root, "." + pathname);
    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      res.writeHead(403).end();
      return;
    }
    const file =
      fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        ? candidate
        : path.join(root, "index.html");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file)
      .on("error", () => {
        res.writeHead(404).end("Run npm run build:web first.");
      })
      .pipe(res);
  })
  .listen(8090, "127.0.0.1", () =>
    console.log("Field Compass preview: http://127.0.0.1:8090"),
  );

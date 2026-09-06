/* ==========================================================================
   server.js — Local Full-Stack Development Server for Sharodiya Radio
   Serves static assets and directly runs /api/ serverless functions locally.
   Requires zero external npm packages (pure Node.js http, fs, path, url).
   ========================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2"
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API Routes: /api/sponsor-report and /api/submit-ad
  if (pathname.startsWith("/api/")) {
    const apiFile = pathname.replace(/^\/api\//, "").replace(/\.js$/, "");

    if (apiFile === "sponsor-report") {
      try {
        const handler = require("./api/sponsor-report.js");
        // Polyfill express-like res helpers for serverless function compatibility
        res.status = function (code) {
          res.statusCode = code;
          return res;
        };
        res.json = function (data) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(data));
          return res;
        };
        req.query = parsedUrl.query;
        return handler(req, res);
      } catch (err) {
        console.error("[server.js] Error executing /api/sponsor-report:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (apiFile === "submit-ad") {
      try {
        const handler = require("./api/submit-ad.js");
        res.status = function (code) {
          res.statusCode = code;
          return res;
        };
        res.json = function (data) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(data));
          return res;
        };

        // Collect body for POST
        let bodyStr = "";
        req.on("data", (chunk) => { bodyStr += chunk; });
        req.on("end", () => {
          try {
            req.body = bodyStr ? JSON.parse(bodyStr) : {};
          } catch (e) {
            req.body = bodyStr;
          }
          req.query = parsedUrl.query;
          handler(req, res);
        });
        return;
      } catch (err) {
        console.error("[server.js] Error executing /api/submit-ad:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }
  }

  // 2. Clean URL Rewrites (matching vercel.json)
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  } else if (pathname === "/admin") {
    pathname = "/admin.html";
  } else if (pathname === "/report" || pathname === "/sponsor-report") {
    pathname = "/report.html";
  }

  // 3. Static File Serving
  let filePath = path.join(ROOT, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Access Denied");
  }

  // If directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  // If file doesn't exist, try appending .html
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("<h1>404 Not Found</h1><p>The requested file does not exist.</p>");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*"
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  শারদীয়া Radio Local Server Running`);
  console.log(`  Listening at: http://localhost:${PORT}`);
  console.log(`  Live Radio:   http://localhost:${PORT}/`);
  console.log(`  Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`  API Routes:   http://localhost:${PORT}/api/sponsor-report`);
  console.log(`======================================================\n`);
});

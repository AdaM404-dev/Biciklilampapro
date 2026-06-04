const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

const noStoreExtensions = new Set([".html", ".css", ".js", ".json"]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getReservationsPath() {
  return path.join(root, "data", "reservations.json");
}

function readReservations() {
  return JSON.parse(fs.readFileSync(getReservationsPath(), "utf8") || "[]");
}

function saveReservation(record) {
  const current = readReservations();
  current.push(record);
  fs.writeFileSync(getReservationsPath(), JSON.stringify(current, null, 2));
}

async function handlePreorder(request, response) {
  try {
    const body = await readBody(request);
    const payload = JSON.parse(body || "{}");
    const type = payload.type === "accessory" ? "accessory" : "preorder";

    if (type === "accessory") {
      const accessory = String(payload.accessory || "").trim();

      if (!accessory) {
        sendJson(response, 400, { ok: false, message: "Missing accessory name." });
        return;
      }

      const record = {
        id: Date.now(),
        type,
        accessory,
        price: payload.price || "",
        product: payload.product || "Bicikli Lámpa Pro",
        source: payload.source || "accessory-card",
        createdAt: new Date().toISOString()
      };

      saveReservation(record);

      sendJson(response, 201, {
        ok: true,
        message: "Accessory added to reservation.",
        record
      });
      return;
    }

    const email = String(payload.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      sendJson(response, 400, { ok: false, message: "Érvényes email címet adj meg." });
      return;
    }

    const record = {
      id: Date.now(),
      type,
      email,
      product: payload.product || "Bicikli Lámpa Pro",
      accessories: Array.isArray(payload.accessories) ? payload.accessories : [],
      source: payload.source || "unknown",
      createdAt: new Date().toISOString()
    };

    saveReservation(record);

    sendJson(response, 201, {
      ok: true,
      message: "Köszönjük. Rögzítettük az előrendelési érdeklődésed.",
      record
    });
  } catch (error) {
    sendJson(response, 500, { ok: false, message: "A mentés nem sikerült." });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": noStoreExtensions.has(ext) ? "no-store" : "public, max-age=60"
    });
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/preorders") {
    handlePreorder(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/preorders") {
    sendJson(response, 200, readReservations());
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`BikeHUD site running at http://localhost:${port}`);
});

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();
const pairCodes = new Map();

app.use(express.static(path.join(__dirname, "..", "web")));
app.get("/api/health", (_, res) => res.json({ ok: true, name: "daboxair" }));

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastDevices() {
  const devices = [...clients.values()].map(c => ({
    id: c.id, name: c.name || "デバイス", platform: c.platform || "unknown"
  }));
  for (const c of clients.values()) send(c.ws, { type: "devices", devices });
}

wss.on("connection", ws => {
  const id = crypto.randomUUID();
  const client = { id, ws, name: "デバイス", platform: "unknown", paired: new Set() };
  clients.set(id, client);

  send(ws, { type: "welcome", id });
  broadcastDevices();

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "identify") {
      client.name = String(msg.name || "デバイス").slice(0, 60);
      client.platform = String(msg.platform || "unknown");
      broadcastDevices();
      return;
    }

    if (msg.type === "pairCode") {
      const code = String(msg.code || "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) return;
      pairCodes.set(code, { id: client.id, expires: Date.now() + 5 * 60 * 1000 });
      send(ws, { type: "pairCodeReady", code });
      return;
    }

    if (msg.type === "pair") {
      const code = String(msg.code || "").replace(/\D/g, "");
      const entry = pairCodes.get(code);
      if (!entry || entry.expires < Date.now()) {
        send(ws, { type: "error", message: "コードが無効または期限切れです。" });
        return;
      }
      const target = clients.get(entry.id);
      if (!target) return;
      client.paired.add(target.id);
      target.paired.add(client.id);
      send(ws, { type: "paired", device: { id: target.id, name: target.name, platform: target.platform } });
      send(target.ws, { type: "paired", device: { id: client.id, name: client.name, platform: client.platform } });
      pairCodes.delete(code);
      return;
    }

    if (msg.type === "share") {
      const packet = msg.packet || {};
      const targets = msg.to ? [msg.to] : [...client.paired];
      for (const targetId of targets) {
        const target = clients.get(targetId);
        if (!target) continue;
        if (targetId !== client.id && !client.paired.has(targetId)) continue;
        send(target.ws, {
          type: "received",
          from: { id: client.id, name: client.name },
          packet,
          receivedAt: Date.now()
        });
      }
      return;
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    for (const c of clients.values()) c.paired.delete(id);
    broadcastDevices();
  });
});

server.listen(PORT, () => console.log(`daboxair running at http://localhost:${PORT}`));
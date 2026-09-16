const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

app.use(express.json({limit:"10mb"}));
app.use(express.static(path.join(__dirname, "..", "web")));

app.get("/api/health", (_, res) => res.json({ok:true, devices:clients.size}));

wss.on("connection", ws => {
  const id = crypto.randomUUID();
  clients.set(id, ws);
  ws.send(JSON.stringify({type:"welcome", id}));

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Demo relay: broadcast to every other connected client.
    if (msg.type === "share") {
      const packet = {...msg, senderId:id, receivedAt:Date.now()};
      for (const [otherId, client] of clients) {
        if (otherId !== id && client.readyState === 1) {
          client.send(JSON.stringify(packet));
        }
      }
    }
  });

  ws.on("close", () => clients.delete(id));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`ShareFlow running on http://localhost:${port}`));
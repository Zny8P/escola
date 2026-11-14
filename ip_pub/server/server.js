const express = require("express");
const path = require("path");
const net = require("net");

const app = express();
const PORT = process.env.PORT || 3000;

// Permite requisições do frontend no GitHub Pages.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://zny8p.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// O Render usa um proxy para receber conexões externas.
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const participants = new Map();
const INACTIVE_TIMEOUT = 30_000;

// Aceita somente IPv4 válido. IPv4 mapeado como IPv6 também é normalizado.
function getPublicIPv4(req) {
  const candidate = req.ip || req.socket.remoteAddress || "";
  const normalized = candidate.startsWith("::ffff:")
    ? candidate.slice("::ffff:".length)
    : candidate;
  return net.isIPv4(normalized) ? normalized : null;
}

app.post("/api/join", (req, res) => {
  const { sessionId } = req.body || {};
  if (typeof sessionId !== "string" || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return res.status(400).json({ error: "Sessão inválida." });
  }

  const ip = getPublicIPv4(req);
  participants.set(sessionId, { ip, lastSeen: Date.now() });
  res.json({ success: true, ipv4Available: Boolean(ip) });
});

app.post("/api/heartbeat", (req, res) => {
  const { sessionId } = req.body || {};
  const participant = participants.get(sessionId);
  if (!participant) {
    return res.status(404).json({ error: "Participante não encontrado." });
  }

  participant.lastSeen = Date.now();
  participant.ip = getPublicIPv4(req);
  res.json({ success: true, ipv4Available: Boolean(participant.ip) });
});

app.get("/api/participants", (req, res) => {
  const now = Date.now();
  for (const [id, participant] of participants) {
    if (now - participant.lastSeen > INACTIVE_TIMEOUT) {
      participants.delete(id);
    }
  }

  const list = [...participants.entries()]
    .filter(([, participant]) => participant.ip !== null)
    .map(([id, participant]) => ({ id, ip: participant.ip }));

  res.json({ count: list.length, participants: list });
});

app.post("/api/leave", (req, res) => {
  const { sessionId } = req.body || {};
  if (typeof sessionId === "string") participants.delete(sessionId);
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});

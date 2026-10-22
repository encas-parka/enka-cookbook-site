#!/usr/bin/env bun
// Récepteur SMTP éphémère pour les sondes d'envoi d'emails en dev.
// Accepte une connexion sur :2525, répond aux verbes de base et journalise
// chaque message (enveloppe + taille du corps) en JSONL :
//   /tmp/opencode/smtp-sink.jsonl
//
// Usage : bun scripts_dev/smtp-sink.mjs [port]   (défaut 2525)
// Arrêt : Ctrl-C.
import { createServer } from "node:net";
import { appendFileSync } from "node:fs";

const PORT = Number(process.argv[2] || 2525);
const SINK_LOG = "/tmp/opencode/smtp-sink.jsonl";

function respond(socket, line) {
  socket.write(line + "\r\n");
}

// Extraire les en-têtes qui exposent les destinataires (To, Cc, Bcc)
function parseRecipientHeaders(dataLines) {
  const headers = {};
  for (const line of dataLines) {
    if (line === "") break; // fin des en-têtes
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }
  return {
    to: headers.to ?? null,
    cc: headers.cc ?? null,
    bcc: headers.bcc ?? null,
  };
}

createServer((socket) => {
  let from = "";
  let rcptTo = [];
  let inData = false;
  let dataLines = [];
  let buffer = "";

  respond(socket, "220 smtp-sink ESMTP ready");

  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\r\n")) {
      const idx = buffer.indexOf("\r\n");
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      if (inData) {
        // Fin de DATA : une ligne réduite à "."
        if (line === ".") {
          inData = false;
          respond(socket, "250 OK queued");
          const recipientHeaders = parseRecipientHeaders(dataLines);
          appendFileSync(
            SINK_LOG,
            JSON.stringify({
              ts: Date.now(),
              from,
              rcptTo,
              headers: recipientHeaders,
            }) + "\n",
          );
          console.log(
            `[smtp-sink] message: from=${from} rcptTo=[${rcptTo.join(", ")}] headers=${JSON.stringify(recipientHeaders)}`,
          );
          from = "";
          rcptTo = [];
          dataLines = [];
        } else {
          dataLines.push(line);
        }
        continue;
      }

      const verb = line.slice(0, 4).toUpperCase();
      if (verb.startsWith("EHLO") || verb.startsWith("HELO")) {
        respond(socket, "250 smtp-sink greets you");
      } else if (verb.startsWith("MAIL")) {
        from = line
          .slice(line.indexOf(":") + 1)
          .trim()
          .replace(/[<>]/g, "");
        respond(socket, "250 OK");
      } else if (verb.startsWith("RCPT")) {
        rcptTo.push(
          line
            .slice(line.indexOf(":") + 1)
            .trim()
            .replace(/[<>]/g, ""),
        );
        respond(socket, "250 OK");
      } else if (verb.startsWith("DATA")) {
        inData = true;
        dataLines = [];
        respond(socket, "354 End data with <CR><LF>.<CR><LF>");
      } else if (verb.startsWith("RSET")) {
        from = "";
        rcptTo = [];
        respond(socket, "250 OK");
      } else if (verb.startsWith("QUIT")) {
        respond(socket, "221 Bye");
        socket.end();
      } else {
        respond(socket, "250 OK");
      }
    }
  });

  socket.on("error", () => {});
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[smtp-sink] listening on 127.0.0.1:${PORT} → ${SINK_LOG}`);
});

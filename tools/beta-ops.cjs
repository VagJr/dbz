"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { Store } = require("../src/store");
async function run(
  args = process.argv.slice(2),
  directory = process.env.DATA_DIR || path.resolve("data"),
) {
  const [command, id, value, ...note] = args;
  if (!command || command === "help")
    return {
      help: [
        "status",
        "reports",
        "resolve <report UUID> reviewed|dismissed <note>",
        "suspend <citizen UUID> <hours 1..8760> <reason>",
        "resume <citizen UUID> <reason>",
        "backup",
      ],
      directory,
      mode: "Servidor deve estar desligado. Nenhuma credencial é exibida.",
    };
  if (
    !["status", "reports", "resolve", "suspend", "resume", "backup"].includes(
      command,
    )
  )
    throw Error("Comando desconhecido; use help.");
  // A mistyped directory must never initialize an empty production world.
  await fs.access(path.join(directory, "checkpoint.json"));
  const store = new Store(directory);
  await store.acquire();
  try {
    await store.init();
    await store.loadWorld();
    const reports = store.worldMemory.reports || [],
      accounts = Object.values(store.accounts);
    if (command === "status")
      return {
        savedAt: new Date(store.lastSavedAt).toISOString(),
        accounts: accounts.length,
        openReports: reports.filter((r) => r.status === "open").length,
        mode: "offline · checksum verificado",
      };
    if (command === "reports")
      return reports.map(
        ({ id, at, from, target, text, status, resolution }) => ({
          id,
          at,
          from,
          target,
          text,
          status,
          resolution,
        }),
      );
    if (command === "backup") {
      const folder = path.join(directory, "backups");
      await fs.mkdir(folder, { recursive: true });
      const destination = path.join(
        folder,
        "checkpoint-" +
          new Date().toISOString().replace(/[:.]/g, "-") +
          ".json",
      );
      await fs.copyFile(path.join(directory, "checkpoint.json"), destination);
      return { backup: destination, verified: true };
    }
    if (command === "resolve") {
      if (
        !["reviewed", "dismissed"].includes(value) ||
        note.join(" ").length < 5
      )
        throw Error(
          "Informe reviewed/dismissed e uma nota de pelo menos cinco caracteres.",
        );
      const report = reports.find((r) => r.id === id);
      if (!report) throw Error("Relato não encontrado.");
      report.status = value;
      report.resolvedAt = Date.now();
      report.resolution = note.join(" ").slice(0, 1000);
    } else {
      const profile = accounts.find((p) => p.citizenId === id);
      if (!profile)
        throw Error(
          "Cidadão não encontrado. Use o UUID do relato, nunca uma chave privada.",
        );
      const reason =
          command === "resume" ? [value, ...note].join(" ") : note.join(" "),
        hours = Number(value);
      if (reason.length < 5)
        throw Error("Informe um motivo com pelo menos cinco caracteres.");
      if (
        command === "suspend" &&
        (!Number.isFinite(hours) || hours < 1 || hours > 8760)
      )
        throw Error("Duração deve estar entre 1 e 8760 horas.");
      profile._account = {
        ...(profile._account || {}),
        bannedUntil: command === "suspend" ? Date.now() + hours * 3600000 : 0,
        moderationReason: reason.slice(0, 1000),
      };
    }
    const audit = (store.worldMemory.audit ||= []);
    audit.push({
      at: Date.now(),
      action: "operator:" + command,
      subject: id,
      ok: true,
    });
    if (audit.length > 2000) audit.splice(0, audit.length - 2000);
    await store.flush();
    return { ok: true, action: command, subject: id };
  } finally {
    await store.release();
  }
}
if (require.main === module)
  run()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
module.exports = { run };

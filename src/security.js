"use strict";
const net = require("node:net");
const bounded = (v, fallback, max) =>
  Number.isFinite(Number(v)) && Number(v) > 0
    ? Math.min(max, Math.floor(Number(v)))
    : fallback;
function config(options = {}) {
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const origins = (options.origins || process.env.UZ_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    production &&
    (!origins.length ||
      origins.some((o) => {
        try {
          return new URL(o).origin !== o || !o.startsWith("https://");
        } catch {
          return true;
        }
      }))
  )
    throw Error("Produção requer UZ_ALLOWED_ORIGINS com origens HTTPS exatas.");
  return {
    production,
    origins,
    maxPlayers: bounded(
      options.maxPlayers || process.env.UZ_MAX_PLAYERS,
      40,
      200,
    ),
    maxConnections: bounded(options.maxConnections, 100, 500),
    maxPerIP: bounded(options.maxPerIP, 8, 100),
    trustedProxyIPs: (
      options.trustedProxyIPs ||
      process.env.UZ_TRUSTED_PROXY_IPS ||
      ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    invite: options.invite || process.env.UZ_BETA_INVITE || "",
  };
}
function originAllowed(origin, host, cfg) {
  if (!origin) return !cfg.production;
  if (cfg.origins.includes(origin)) return true;
  if (cfg.production) return false;
  try {
    const u = new URL(origin);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
      u.host === host
    );
  } catch {
    return false;
  }
}
function clientIP(address, headers, cfg) {
  const remote = String(address || "unknown").replace(/^::ffff:/, "");
  if (!cfg.trustedProxyIPs.includes(remote)) return remote;
  const forwarded = headers["x-real-ip"];
  return typeof forwarded === "string" && net.isIP(forwarded)
    ? forwarded.replace(/^::ffff:/, "")
    : remote;
}
class Limiter {
  constructor() {
    this.entries = new Map();
  }
  allow(key, max, ms) {
    const now = Date.now();
    if (!this.entries.has(key) && this.entries.size >= 10000) {
      for (const [k, v] of this.entries)
        if (v.until < now) this.entries.delete(k);
      if (this.entries.size >= 10000) return false;
    }
    let e = this.entries.get(key);
    if (!e || now >= e.until) {
      e = { n: 0, until: now + ms };
      this.entries.set(key, e);
    }
    if (this.entries.size > 10000)
      for (const [k, v] of this.entries)
        if (v.until < now) this.entries.delete(k);
    return ++e.n <= max;
  }
}
function headers(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  next();
}
module.exports = { config, originAllowed, clientIP, Limiter, headers };

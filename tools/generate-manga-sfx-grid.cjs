"use strict";

// Edit the labels and motifs here, or edit any sfx-XX group in the generated SVG.
// Each cell is 240x120, numbered left-to-right, top-to-bottom on a transparent sheet.
const fs = require("node:fs");
const path = require("node:path");

const CELL_W = 240;
const CELL_H = 120;
const COLS = 7;
const words = [
  ["AHHHHH!", "charge"], ["PUNCHHH!!", "impact"], ["SMMSHH!!!", "slash"], ["WHAM!!", "impact"], ["THWACK!!", "speed"], ["KRAK!!", "slash"], ["BOOM!!!", "burst"],
  ["HAAAH!!", "charge"], ["HYAAH!!", "charge"], ["ORAA!!", "speed"], ["HOOO!!", "charge"], ["FWOOSH!!", "speed"], ["VZAAAM!!", "energy"], ["ZAAAP!!", "energy"],
  ["BAMMM!!", "impact"], ["BASH!!", "impact"], ["KAPOW!!", "burst"], ["KRAAASH!!", "slash"], ["KABOOM!!", "burst"], ["DOOOOM!!", "burst"], ["CLANG!!", "impact"],
  ["POW!!", "impact"], ["SMACK!!", "impact"], ["THUD!!", "impact"], ["KRUNCH!!", "slash"], ["SPLASH!!", "burst"], ["WOOOSH!!", "speed"], ["SWISH!!", "speed"],
  ["ZING!!", "energy"], ["ZOOM!!", "speed"], ["SHOOOM!!", "speed"], ["FLASH!!", "energy"], ["BURST!!", "burst"], ["BLAAST!!", "energy"], ["KIIII!!", "charge"],
  ["GRRRAH!!", "charge"], ["YAAAA!!", "charge"], ["TAKE THIS!!", "charge"], ["HRAAA!!", "charge"], ["KAMEHAMEHA!!", "energy"], ["GALICK HO!!", "energy"], ["MASENKO!!", "energy"],
  ["IMPACT!!", "impact"], ["COUNTER!!", "slash"], ["BREAK!!", "slash"], ["PARRY!!", "impact"], ["CRACK!!", "slash"], ["PUMMEL!!", "impact"], ["BANG!!", "burst"],
];

function escaped(value) {
  return value.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[ch]);
}

function motif(type, n) {
  const flip = n % 2 ? 1 : -1;
  switch (type) {
    case "speed":
      return `<g class="speed-lines" stroke="#13171b" stroke-linecap="square" fill="none">
        <path d="M13 28 H82 M7 39 H55 M27 91 H93 M17 103 H69" stroke-width="3"/>
        <path d="M164 18 H226 M185 28 H235 M160 93 H228 M195 106 H235" stroke-width="2"/>
        <path d="M11 53 H37 M194 83 H233" stroke-width="5"/>
      </g><path d="M26 77 68 31 206 35 178 91 35 95Z" fill="#f8f7f1" stroke="#12171c" stroke-width="3"/>`;
    case "slash":
      return `<g fill="#12171c"><path d="M14 16 67 49 52 53Z"/><path d="M29 97 73 80 57 86Z"/>
        <path d="m201 18 23-7-31 42Z"/><path d="m218 106-47-27 17 3Z"/></g>
        <path d="M21 70 94 24 211 31 175 95 46 90Z" fill="#f8f7f1" stroke="#12171c" stroke-width="3"/>
        <path d="M26 85 219 18" fill="none" stroke="#12171c" stroke-width="2"/>`;
    case "burst":
      return `<path d="m13 52 35-7-16-29 43 19L90 9l31 26 27-24 15 25 43-22-11 31 32 7-24 18 20 28-48-7-18 19-30-21-34 21-19-20-49 10 22-30Z" fill="#faf9f4" stroke="#15191e" stroke-width="3"/>
        <g fill="#15191e"><path d="m19 10 37 28-10 2Z"/><path d="m225 101-38-25 9-3Z"/></g>`;
    case "charge":
      return `<path d="M22 86 60 33 111 17 174 26 221 80 171 99 58 96Z" fill="#faf9f4" stroke="#15191e" stroke-width="3"/>
        <g stroke="#15191e" stroke-width="2" fill="none"><path d="M23 19 43 35 M69 7 79 25 M177 10 169 28 M220 23 201 42 M15 102 48 88 M219 102 198 87"/></g>`;
    case "energy":
      return `<path d="M15 63 39 48 27 29 62 40 82 12 102 34 133 16 149 36 189 25 186 44 225 54 196 69 217 92 175 86 162 106 127 89 90 106 75 87 30 91 46 74Z" fill="#f8f7f1" stroke="#14191d" stroke-width="3"/>
        <g stroke="#15191e" fill="none"><path d="M15 20 43 35 M7 92 40 80 M196 25 232 9 M198 93 233 112" stroke-width="2"/>
        <path d="M${flip > 0 ? 35 : 205} 11 ${flip > 0 ? "58 33" : "184 35"}" stroke-width="4"/></g>`;
    default:
      return `<path d="M20 57 45 31 72 37 94 12 124 33 164 14 177 36 215 32 200 62 223 84 173 85 158 108 121 91 79 107 58 87 19 83Z" fill="#f8f7f1" stroke="#15191e" stroke-width="3"/>
        <g fill="#14191d"><path d="m5 16 56 28-9 5Z"/><path d="m233 97-53-24 9-5Z"/></g>`;
  }
}

function cell([word, style], index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const id = String(index + 1).padStart(2, "0");
  const tilt = [-6, 3, -4, 5, -3, 2, -5][index % COLS];
  const dark = index % 5 === 2 || index % 7 === 4;
  const size = Math.max(25, Math.min(49, 59 - word.length * 2));
  // Keep the letters editable; the two outlines give a crisp manga-ink edge.
  const lettering = `<g transform="rotate(${tilt} 120 65)" text-anchor="middle" dominant-baseline="middle"
    font-family="Impact,Arial Black,DejaVu Sans,sans-serif" font-weight="900" font-style="italic" letter-spacing="-1">
      <text x="122" y="67" font-size="${size}" fill="${dark ? "#f8f7f1" : "#15191e"}" stroke="${dark ? "#15191e" : "#f8f7f1"}" stroke-width="10" paint-order="stroke fill" textLength="${word.length > 11 ? 190 : word.length > 8 ? 187 : 159}" lengthAdjust="spacingAndGlyphs">${escaped(word)}</text>
      <text x="120" y="64" font-size="${size}" fill="${dark ? "#f8f7f1" : "#15191e"}" stroke="${dark ? "#15191e" : "#f8f7f1"}" stroke-width="5" paint-order="stroke fill" textLength="${word.length > 11 ? 190 : word.length > 8 ? 187 : 159}" lengthAdjust="spacingAndGlyphs">${escaped(word)}</text>
    </g>`;
  return `<g id="sfx-${id}" data-word="${escaped(word)}" data-style="${style}" transform="translate(${col * CELL_W} ${row * CELL_H})">
    <title>${escaped(word)}</title>
    ${motif(style, index)}
    <path d="M29 109 H66 M172 12 H211" stroke="#13171b" stroke-width="1.5" opacity=".72"/>
    ${lettering}
  </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Editable transparent 7 x 7 onomatopoeia atlas. Each group is a 240 x 120 cell. -->
<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="840" viewBox="0 0 1680 840">
  <title>Universe Z — Manga Combat SFX, 7 × 7</title>
  <desc>49 separate ink-lettering groups. Toggle the hidden guides group in an SVG editor for cutting.</desc>
  <g id="guides" display="none" fill="none" stroke="#ff00aa" stroke-width="1">${words.map((_, i) => `<rect x="${(i % COLS) * CELL_W}" y="${Math.floor(i / COLS) * CELL_H}" width="${CELL_W}" height="${CELL_H}"/>`).join("")}</g>
  ${words.map(cell).join("\n  ")}
</svg>
`;

if (words.length !== 49) throw new Error("The SFX atlas must contain exactly 49 cells.");
const target = path.join(__dirname, "..", "public", "assets", "manga", "onomatopoeia-grid.svg");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, svg, "utf8");

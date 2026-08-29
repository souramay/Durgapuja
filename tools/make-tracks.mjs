#!/usr/bin/env node
/* ==========================================================================
   make-tracks.mjs — turn a wall of pasted YouTube links into a TRACKS block
   you can drop straight into config.js.

     node tools/make-tracks.mjs links.txt
     cat links.txt | node tools/make-tracks.mjs

   Feed it anything: bare URLs, markdown links, a chat message, a mix.
   It pulls out every video id it can find, keeps the order, drops
   duplicates, and tells you which lines yielded nothing.

   Titles: put one before the link on the same line and it is picked up,
     Bajlo Tomar Alor Benu — https://www.youtube.com/watch?v=XXXXXXXXXXX
   otherwise you get a placeholder to fill in.
   ========================================================================== */

import { readFileSync } from "node:fs";

const VIDEO = /(?:youtu\.be\/|watch\?(?:.*&)?v=|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
const LIST  = /[?&]list=((?:PL|UU|LL|FL|OL)[A-Za-z0-9_-]{10,})/;
const SEARCH = /\/results\?/;

const src = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : readFileSync(0, "utf8");

const seen = new Set();
const tracks = [];
const playlists = new Set();
const searches = [];

for (const raw of src.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith("#") || line.startsWith("//")) continue;   // comments

  const list = line.match(LIST);
  if (list) playlists.add(list[1]);

  const m = line.match(VIDEO);
  if (!m) {
    if (SEARCH.test(line)) searches.push(line);
    continue;
  }
  const id = m[1];
  if (seen.has(id)) continue;
  seen.add(id);

  // anything before the url on the line, stripped of markdown/bullets
  let title = line.slice(0, m.index).replace(/https?:\S*/g, "");
  title = title.replace(/^[\s*\-–—•\d.)\]]+/, "").replace(/[\[\]*_`]/g, "");
  title = title.replace(/[\s\-–—:|(<]+$/, "").trim();

  tracks.push({ id, title });
}

const q = (s) => '"' + s.replace(/"/g, '\\"') + '"';
const pad = Math.max(0, ...tracks.map((t) => (t.title || "").length));

console.log("var TRACKS = [");
for (const t of tracks) {
  const title = t.title || "TITLE HERE";
  console.log(
    "  { id: " + q(t.id) + ", title: " + (q(title) + ",").padEnd(pad + 4) +
    " artist: \"\" },"
  );
}
console.log("];");

const note = (msg) => process.stderr.write(msg + "\n");
note("");
note(`  ${tracks.length} video id${tracks.length === 1 ? "" : "s"} found`
   + (searches.length ? `, ${searches.length} search link${searches.length === 1 ? "" : "s"} skipped` : ""));

if (searches.length) {
  note("");
  note("  Search links carry no video id — open each one, click the video");
  note("  you want, and copy the watch?v=… URL from the address bar:");
  for (const s of searches.slice(0, 4)) {
    const qy = decodeURIComponent((s.match(/search_query=([^)\s\]]*)/) || [, ""])[1]).replace(/\+/g, " ");
    note("    · " + (qy || s).slice(0, 62));
  }
  if (searches.length > 4) note(`    · …and ${searches.length - 4} more`);
}

if (playlists.size) {
  note("");
  note("  Playlist id" + (playlists.size === 1 ? "" : "s") + " spotted — one of these in PLAYLIST");
  note("  replaces the whole TRACKS list:");
  for (const p of playlists) note("    var PLAYLIST = " + q(p) + ";");
}

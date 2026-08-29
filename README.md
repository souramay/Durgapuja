# শারদীয়া · Sharodiya

Non-stop Durga Puja radio over cartoon Puja posters. Static HTML/CSS/JS — no build step, no dependencies, no API keys.

---

## The one thing you have to do

Open [config.js](config.js). Line 14:

```js
var PLAYLIST = "";
```

Open any Durga Puja playlist on YouTube. The address bar reads `youtube.com/playlist?list=PLxxxxxxxxxxxx` — paste everything after `list=` between those quotes:

```js
var PLAYLIST = "PLrAXtmRdnEQy6nuLMfO6uJ8gLbNQg9nZ0";
```

That's it. The site plays it forever, shuffled, wrapping at the end. **Nobody visiting the site ever sees an input box** — they tap once and music starts.

Leave it empty and a live synthesised dhak ensemble plays instead, so the site is never silent.

> Why isn't this pre-filled? I built this offline and can't check whether any given video ID is real, still up, or embeddable. Guessing eleven-character IDs would just produce "video unavailable" — so the one field I can't fabricate is left to you.

### Bulk-adding songs

Paste your links into a text file — any format, markdown and tracking params
and all — and let the converter build the block for you:

```bash
node tools/make-tracks.mjs links.txt
```

It prints a ready-to-paste `var TRACKS = [...]`, keeping your order, dropping
duplicates, and picking up any title you wrote before the link on the same
line. It also reports which lines it could not use.

**Search links do not work.** A `youtube.com/results?search_query=…` URL names
a query, not a video — which video comes back depends on who is searching and
when, so there is no id in it to extract. Open the search, click the song you
actually want, and copy the `watch?v=…` URL from the address bar.

---

## Deploy to Vercel

Push to GitHub, then at [vercel.com/new](https://vercel.com/new) import the repo — framework preset **Other**, build command and output directory both empty.

Or from the CLI:

```bash
npm i -g vercel
vercel --prod
```

[vercel.json](vercel.json) already sets caching and security headers, with `config.js` on `no-cache` so a playlist change goes live on the next reload instead of sticking in the CDN.

### Locally

YouTube's player refuses to run from `file://`, so use a server:

```bash
npm run dev     # http://localhost:3000
```

**Do not just double-click `index.html`.** From `file://` the YouTube player refuses to load at all — there is no origin it will accept — so you get the synthesised ensemble and a message explaining why. Serve it, or deploy it.

---

## The posters

Seven flat-vector scenes, drawn as inline SVG. Thick ink outlines, halftone, hard shadows, sticker badges — playlist-cover energy rather than gallery art. They crossfade every 18 seconds and pulse on the beat.

| | |
|---|---|
| **ঢাকের তালে** Dhaak Drop | the dhaki mid-roll, sound rings coming off the drum |
| **ধুনুচি নাচ** Dhunuchi Nights | dancer with two smoking pots, crowd in silhouette |
| **প্যান্ডেল হপিং** Pandal Hopping | three friends walking under an arch and string lights |
| **সেলফি স্কোয়াড** Selfie Squad | heads clustered round an outstretched phone |
| **বাসে করে** Route 24 | the bus, passengers in the windows, conductor hanging out the door |
| **সিঁদুর খেলা** Sindoor Khela | two women and a burst of red powder |
| **লো-ফাই পুজো** Lo-fi Pujo | headphones on a rooftop, cassette floating past |

Nothing is loaded from anywhere — each poster is a few kilobytes of markup, stays sharp at any size, and `↓` exports the live one as a 2560×1600 PNG.

To add your own, write a function returning SVG markup and add a row to `SCENES` at the bottom of [js/scenes.js](js/scenes.js). The primitives at the top (`bod`, `ln`, `ci`, `face`, `garland`, `halftone`) do most of the work.

---

## Keyboard

| Key | |
|---|---|
| `Space` | play / pause |
| `←` `→` | previous / next poster |
| `↑` `↓` | volume |
| `S` | save the poster as a PNG |
| `F` | fullscreen · `M` mute |

There is no skip — the queue advances on its own and wraps forever. Media keys
play and pause; the OS now-playing widget shows the station, not the song.

Somewhere in here is an easter egg. Two ways in, and that is all the help you get.

---

## Layout

```
config.js          your playlist
js/scenes.js       the seven posters + the crossfade stage
js/ensemble.js     the synthesised fallback — dhak, kanshor, shankha,
                   tanpura and a bansuri improvising in Raga Durga
js/youtube.js      IFrame Player API wrapper + URL parsing
js/player.js       one transport over both sources, plus the visualiser
js/main.js         DOM wiring, shortcuts
```

**Two things worth knowing.**

There is no start screen — the site drops straight into the player and begins on load. It begins **muted**, because muted autoplay is the only kind any browser permits without a user gesture. A small lime pill says *tap for sound*, and the first click, keypress, tap or scroll anywhere turns it on and dismisses the pill. That gesture is a hard browser requirement, not a design choice; nothing can start audible on its own.

YouTube doesn't expose its audio to Web Audio, so nothing on the page can read the actual waveform while a track plays. The visualiser and the beat pulse run on a tempo clock instead — it reads as musical but isn't literally following the song. On the live ensemble the audio is ours, so those visuals come from a real `AnalyserNode`.

## Licensing

The code and all seven posters are yours to do anything with. The music is not: YouTube tracks stream from YouTube under their terms, and whether a video can be embedded is the rights holder's call. Videos that refuse are skipped automatically; if every one in a playlist refuses, the ensemble takes over. The ensemble is synthesised from scratch and carries no restrictions.

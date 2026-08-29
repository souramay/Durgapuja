# music/

Drop audio files here and the site plays them instead of YouTube.

**This is the most reliable source by far.** No embedding permissions, no
API, no third party — the files come from your own server, so they cannot
be blocked, geo-restricted or taken down mid-song. It also gives you a real
visualiser: because the audio is same-origin, the bars and the beat pulse
are driven by the actual waveform rather than a guessed tempo.

## Adding songs

1. Put the files in this folder — `.mp3`, `.m4a`, `.ogg` or `.wav`
2. List them in `config.js`:

```js
var LOCAL = [
  { file: "bajlo-tomar-alor-benu.mp3", title: "Bajlo Tomar Alor Benu", artist: "" },
  { file: "dhaker-taal.mp3",           title: "Dhaker Taal",           artist: "" },
];
```

Only `file` is required. Keep the filenames simple — lowercase, hyphens, no
spaces or accents — so they survive being served from a URL.

Local files take priority over the YouTube list in `config.js`. Empty this
list and it falls back to YouTube, then to the synthesised ensemble.

## Where to get files you can actually host

Putting a file here publishes it to everyone who visits your site, so it
needs to be something you have the right to distribute:

- **Music you own or made**, or recordings you have a licence for
- **Creative Commons** — [Free Music Archive](https://freemusicarchive.org),
  [ccMixter](https://ccmixter.org), [Pixabay Music](https://pixabay.com/music/).
  Search for dhak, tabla, Indian percussion. Check each licence: some need
  attribution, some forbid commercial use
- **YouTube Audio Library** (studio.youtube.com) — free, cleared for reuse
- **The built-in ensemble** — no files at all, and it already sounds like Puja

Commercial releases from Saregama, INRECO and the like are not on that list.
Ripping them from YouTube and serving them here is redistribution, and the
labels enforce it. Link out to those, or use YouTube's embed — which is
exactly what the YouTube mode is for.

## Size

Audio is by far the heaviest thing on this site. A 5-minute MP3 at 128 kbps
is about 5 MB, and Vercel's free tier is generous but not infinite. For a
long playlist, prefer 96–128 kbps mono for spoken pieces and 128–192 kbps
for music, or keep the big stuff on YouTube.

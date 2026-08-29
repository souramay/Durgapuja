# media/

Video or GIF backgrounds. Drop a file here, name it in `config.js`:

```js
var BACKGROUND = "media/pujo-loop.mp4";
```

Or use `"youtube"` to put the playing music video itself behind everything.
The 🎞 button in the top bar toggles whichever is configured, and
`?bg=media/pujo-loop.mp4` or `?bg=youtube` overrides it per visit.

## Format

**Use MP4 or WebM, not GIF.** A GIF of the same clip is roughly ten times
the size at worse quality, and it cannot be hardware-decoded. `.gif`,
`.webp`, `.png` and `.jpg` all work here — they load as an `<img>` — but a
video is the right answer for anything moving.

```bash
# a good background loop from any source clip
ffmpeg -i input.mp4 -t 8 -an -vf "scale=1920:-2,fps=24" \
       -c:v libx264 -crf 26 -preset slow -movflags +faststart media/pujo-loop.mp4
```

`-an` strips the audio, which matters: the background is always muted, and a
silent file is smaller. Aim for under 5 MB. Eight seconds is plenty — a
well-chosen loop reads as continuous.

## Choosing a clip

The player, the sound pill and the credits all sit over this, so the same
rule as the posters applies: **keep the bottom third calm.** Slow drifting
movement — smoke, bokeh, falling petals, a locked-off crowd — works far
better than fast cuts, which fight the music and make text unreadable.

`docs/motion-prompts.md` has prompts for generating one, including which
directions loop cleanly.

## Where files can come from

Anything you shot, made, or hold a licence for. For stock, Pexels, Pixabay
and Coverr all publish free video under permissive licences — check each
clip's terms. Footage scraped from someone's YouTube upload is not yours to
serve, same as with audio.

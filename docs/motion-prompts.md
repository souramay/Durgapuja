# Motion prompts — video & GIF for শারদীয়া

Paste-ready context for any AI video tool (Sora, Veo, Kling, Runway, Pika, Luma, Hailuo, Seedance). Everything here is derived from the site's real palette and scenes, so what comes back should sit next to the posters rather than clash with them.

---

## Read this first — the shortcut that beats every prompt

The site already exports its posters as **2560×1600 PNGs** — press `↓` in the top bar, or `S` on the keyboard, on whichever poster you want.

Feed that PNG into an **image-to-video** model instead of writing a text-to-video prompt. You get the exact characters, exact palette, exact line weight, for free — no model has to guess what your site looks like. Then the prompt only has to describe *motion*, which is the part models are actually good at.

**Text-to-video is the fallback**, for when you want a shot the site doesn't already have.

So the workflow is:

1. Open the site, land on the poster you want, press `↓`
2. Upload that PNG as the first frame
3. Paste one of the **motion-only prompts** below
4. Export, then add any Bengali type in post — see the warning at the bottom

---

## The style block

Prepend this to any **text-to-video** prompt. Skip it for image-to-video; the image already says all of it.

```
Flat 2D vector animation, screen-print / risograph poster look. Bold
uniform dark outlines (#1B0E2B) on every shape, rounded line caps, no
gradients, no 3D, no realistic lighting. Large areas of flat saturated
colour with a visible halftone dot texture and light film grain over the
whole frame. Characters are simple geometric cartoon people — round
heads, dot eyes, circular blush, minimal or no nose, thick limbs drawn as
single rounded strokes. Warm South Asian skin tones. Bengali Durga Puja
festival setting. Limited palette only: deep ink #1B0E2B, cream #FFF3E2,
hot pink #FF3B6B, marigold #FFC93C, lime #A8E10C, purple #6C4AB6,
teal #00A6A6, orange #FF6B35. Confident, playful, poster-like. Locked-off
camera, no camera movement, no zoom. Seamless loop.
```

### Negative prompt

```
photorealistic, 3D render, realistic skin, soft shading, gradients,
depth of field, lens flare, motion blur, text, letters, watermark,
extra fingers, deformed hands, distorted faces, cluttered background,
muted colours, sepia, horror, uncanny
```

---

## Settings

| | GIF | Video |
|---|---|---|
| Length | 2–4 s | 5–10 s |
| FPS | 12–15 | 24 |
| Aspect | 1:1 or 4:5 | 16:9 site header · 9:16 reels |
| Loop | seamless, required | nice to have |
| Palette | 64–128 colours | — |

Flat vector with no gradients is close to the ideal case for GIF — big flat areas compress hard and posterise cleanly. Keep it under ~5 MB for a header, ~2 MB for social.

**MP4/WebM beats GIF** for anything on the site itself: roughly a tenth the size at better quality. Use `<video autoplay muted loop playsinline>`. Save GIF for places that won't take video.

---

## Motion-only prompts (image-to-video)

Short and specific. Name the moving parts and nothing else — the still already carries the style.

**ঢাকের তালে · Dhaak Drop**
```
The drummer bounces gently on the beat. His arms strike the drum, sticks
moving up and down. Concentric sound rings pulse outward from the drum
head and fade. Feathers on the drum sway. The starburst behind him rotates
very slowly. Everything else holds still. Seamless loop.
```

**ধুনুচি নাচ · Dhunuchi Nights**
```
The dancer sways side to side holding both smoking pots. Thick white smoke
curls upward from each pot and dissipates. Embers glow and pulse. The crowd
silhouettes bob slightly. Stars twinkle. Seamless loop.
```

**প্যান্ডেল হপিং · Pandal Hopping**
```
Three friends walk in place with a light bouncing gait, slightly out of sync
with each other. String lights above them twinkle in sequence. Their clothes
sway. The pandal arch behind stays still. Seamless loop.
```

**সেলফি স্কোয়াড · Selfie Squad**
```
The three heads bob and lean toward each other. The phone in the outstretched
hand drifts slightly. A white flash blooms once and fades. Sparkle stickers
twinkle around the frame. Seamless loop.
```

**বাসে করে · Route 24**
```
The bus rocks gently as if idling. Passengers' heads bob in the windows. The
conductor leans out and waves. Marigold garland sways. Music notes float up
from the speaker and fade out. Wheels rotate slowly. Seamless loop.
```

**সিঁদুর খেলা · Sindoor Khela**
```
Two women sway toward each other, laughing. Clouds of red sindoor powder
burst outward in soft particles and drift down. Their sarees ripple. Seamless
loop.
```

**লো-ফাই পুজো · Lo-fi Pujo**
```
The seated figure nods slowly to the music, headphones on. Steam curls up from
the tea cup. The cassette floats and rotates gently. Pandal lights on the
skyline twinkle. Seamless loop, very calm, slow.
```

---

## Text-to-video prompts

Style block first, then one of these.

**Hero loop** — for a site header or OG preview
```
A flat vector cartoon Durga Puja scene. Centre: a drummer in a red kurta
playing a large barrel dhak slung across his chest, feathers tied to the drum,
bouncing on the beat. Concentric sound rings pulse outward from the drum and
fade. Behind him a large cream circle and a slowly rotating marigold
starburst on a hot pink background. A marigold garland strung across the top
sways. Halftone texture over everything.
```

**Crowd / pandal energy**
```
A flat vector cartoon crowd of Bengali festival-goers walking beneath a tall
red pandal arch on a marigold yellow background, string lights twinkling
overhead. Simple round-headed characters with dot eyes in sarees and kurtas,
bobbing as they walk. Halftone texture, thick dark outlines.
```

**Loopable texture** — good behind type, or as a subtle background
```
A seamless loop of flat vector marigold flowers and white shiuli petals
falling slowly against a deep purple background, with a rotating alpona
mandala of thin cream lines in the centre. Halftone dots, film grain, thick
dark outlines, no gradients.
```

**Vertical / reel opener**
```
Vertical 9:16 flat vector animation. A woman in a red and cream saree dances
holding two smoking dhunuchi pots above her head, swaying side to side. Thick
white smoke curls upward. Deep indigo night background with twinkling gold
stars and a crescent moon. Bold dark outlines, halftone texture, flat
saturated colour.
```

---

## Where the output goes

| Use | Format | Notes |
|---|---|---|
| Social preview | 1200×630 PNG or MP4 | add `<meta property="og:image">` — the site has none yet |
| README banner | GIF or MP4 | GitHub renders both |
| Reels / stories | 9:16 MP4 | the vertical prompt above |
| Loading screen | WebM + MP4 | behind the start screen, muted |

To drop one behind the start screen, add it under `.gate-blob` in `index.html`:

```html
<video class="gate-video" autoplay muted loop playsinline
       poster="docs/hero.jpg" src="docs/hero.mp4"></video>
```

…then position it `absolute; inset:0; object-fit:cover; opacity:.35`. Keep it muted — an unmuted autoplaying video is blocked by every browser, and it would fight the dhak.

---

## Two things that will bite you

**Models cannot spell.** Every current video model produces mangled letterforms, and Bengali script comes back as convincing-looking nonsense — the shapes are right, the words are not. Never put `শুভ শারদীয়া` or any other text in a prompt. Generate the artwork clean, then add type in After Effects, Canva, or CapCut, where you control the font. The site's own faces are Baloo Da 2 for Bengali and Archivo Black for Latin.

**Hands and faces drift.** Six-fingered hands and warping faces are the usual failure. Two defences: keep clips short (3–5 s), and prefer prompts where hands are busy with an object — holding a pot, gripping drum sticks — since models handle a gripped hand far better than a loose one. If a face melts, re-roll rather than trying to fix it in the prompt.

---

*Written against the site's real palette and the seven scenes in `js/scenes.js`. Untested — I have no access to any generation tool from here, so treat these as well-formed starting points to iterate on, not guaranteed one-shot results.*

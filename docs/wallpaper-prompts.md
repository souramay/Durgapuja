# Wallpaper prompts — শারদীয়া

Ten distinct visual directions, not one look repeated ten times. The point is that flipping between wallpapers should feel like flipping between different worlds, not different crops of the same idea.

Works in Midjourney, Flux, Ideogram, DALL·E, Nano Banana / Gemini, SDXL. Tool-specific notes at the bottom.

---

## How to use these

1. Pick a direction below. Paste the prompt.
2. Append the **quality tail** for your tool (see bottom).
3. Generate 4, keep 1. Re-roll faces — they're the usual failure.
4. Export **16:9** for desktop, and re-run the same prompt at **9:16** for phones. Don't crop one from the other; the composition breaks.
5. Convert to WebP at ~85% quality, target under 400 KB each.

**One rule that matters more than any prompt:** keep the bottom-left third of the frame quiet — empty sky, flat wall, out-of-focus ground. That's where the site's poster type and the player sit. A busy corner there and the whole thing turns to mud.

---

## 1 · Neon Kolkata night

The one most likely to actually go viral. Rain-slick streets and neon read as expensive.

```
A towering Durga pandal at night on a rain-slick Kolkata street, glowing
with hundreds of warm string lights and neon signage in Bengali-inspired
lettering. Wet asphalt mirrors the entire scene in long vertical smears of
magenta, gold and cyan. Crowds of small silhouetted figures with umbrellas
move through the foreground, motion-blurred. Volumetric haze catches the
light. Cinematic wide shot, low angle, deep depth. Moody teal shadows
against hot marigold highlights. Ultra detailed, dramatic, atmospheric.
```

## 2 · Claymation / soft 3D

Squishy, tactile, extremely current. Reads as premium on a phone screen.

```
Charming handmade claymation scene of Durga Puja. Chubby stylised clay
figures with visible thumbprints and fingerprint texture — a drummer with a
barrel dhak, women in tiny red-bordered clay sarees dancing with smoking
brass pots. Miniature clay pandal behind them built from rolled coils.
Soft studio lighting, shallow depth of field, tilt-shift miniature look.
Warm cream, terracotta, marigold and deep red palette. Stop-motion still
frame, tactile, adorable, highly detailed macro.
```

## 3 · Anime cinematic

```
Anime key visual of a Bengali girl in a red-and-white saree standing before
an enormous illuminated Durga idol, seen from behind over her shoulder.
Golden hour light rakes across her, hair and anchal lifting in the wind.
Petals and incense smoke drift through shafts of light. Lush painted
background, glowing bokeh from the pandal lamps, dramatic sky in orange and
violet. Cel-shaded, crisp linework, film-grade colour grading, emotional
and cinematic. Wide 16:9 composition.
```

## 4 · Risograph poster

Closest to the site's existing look, but far richer than vector.

```
Risograph screen print poster of a Durga Puja street scene, printed in only
four inks — fluorescent pink, marigold yellow, deep navy and cream. Visible
misregistration, coarse halftone dots, ink texture and paper grain. Bold
simplified shapes: a dhaki mid-strike, dancing figures, a pandal arch,
marigold garlands. Heavy black keyline. Flat, graphic, confident, 1970s
print-shop feel. High contrast, no gradients.
```

## 5 · Macro embers

No faces at all — so nothing can go wrong, and it's gorgeous on a dark screen.

```
Extreme macro photograph of a brass dhunuchi pot overflowing with burning
coconut husk. Thick white incense smoke coils upward through a shaft of warm
light. Glowing orange embers scatter and float, sharply lit against an
almost-black background. Shallow depth of field, ember bokeh, tiny sparks
frozen mid-air. Deep reds, molten orange, gold. Dramatic chiaroscuro
lighting, hyper-detailed, cinematic still.
```

## 6 · Sindoor burst

```
High-speed photograph of two women in white sarees with red borders throwing
vermilion powder at each other, mid-laugh, caught at the instant of impact.
Enormous plumes of crimson pigment explode outward and hang suspended,
backlit so the powder glows at the edges. Faces joyful, slightly blurred
with motion. Bright overcast light, clean pale background so the red reads
violently. Ultra sharp, high shutter speed, vivid saturation.
```

## 7 · Papercut diorama

```
Layered papercut diorama of Durga Puja, built from seven receding planes of
cut coloured card. Front layer: marigold garlands and silhouetted
celebrating figures. Middle: an ornate pandal arch with intricate lace-like
cut filigree. Back: a full moon and radiating paper rays. Each layer casts a
soft real shadow on the one behind it. Warm rim light from within. Coral,
saffron, cream and deep plum. Craft texture, immaculate, tactile.
```

## 8 · Retro Bengali film poster

```
Vintage 1970s Bengali film poster for Durga Puja. Hand-painted lithograph
style with visible brushwork and slight colour offset. A dramatic
lantern-jawed dhaki mid-performance, a heroine in a red saree, and a
towering idol composited behind them in bold overlapping panels. Aged paper
texture, foxing, faded edges, folded creases. Saturated primary reds,
mustard yellow, ink black. Dramatic, theatrical, nostalgic.
```

## 9 · Sticker bomb

Chaotic and fun — the maximalist option.

```
Dense sticker-bomb collage of Durga Puja iconography, edge to edge with no
background showing. Hundreds of overlapping die-cut vinyl stickers with
thick white borders and glossy highlights: dhak drums, dhunuchi pots,
marigold flowers, conch shells, tridents, cartoon faces with dot eyes,
tiny buses, cassette tapes, disco balls. Bold cartoon outlines, clashing
saturated colours, playful chaos. Flat lay, evenly lit, crisp and graphic.
```

## 10 · Editorial fashion

```
High-fashion editorial photograph of three young Bengali friends in modern
reinterpreted Puja outfits — a red-bordered saree worn with chunky
sneakers, an oversized silk panjabi, layered gold jewellery. Posed
confidently against a vast out-of-focus pandal wall of warm lights. Shot on
medium format, natural window light, muted film grade with deep shadows and
warm skin tones. Editorial, cool, aspirational, quiet luxury. Negative
space on the left.
```

---

## Reusable modifiers

Bolt onto any prompt above.

**More drama** — `dramatic rim lighting, volumetric god rays, deep shadows, high contrast`
**More saturated** — `hyper-saturated, punchy colour grade, vivid magenta and marigold`
**Calmer** — `soft diffused light, muted pastel palette, gentle and airy`
**Phone wallpaper** — `vertical composition, subject in upper two thirds, clean space at the bottom`
**Set consistency** — reuse one seed across prompts, or in Midjourney add `--sref <url-of-your-favourite>` to carry a style across the whole set

## Negative prompt

For Flux / SDXL / anything with a negative field:

```
text, letters, words, watermark, signature, logo, extra fingers, six
fingers, deformed hands, fused fingers, distorted face, asymmetrical eyes,
blurry, low resolution, jpeg artifacts, oversaturated skin, plastic skin,
cluttered bottom left corner, busy foreground
```

## Quality tails

| Tool | Append |
|---|---|
| Midjourney | `--ar 16:9 --style raw --stylize 250 --v 7` (phones: `--ar 9:16`) |
| Flux | `--aspect 16:9`, guidance 3–4, 28–40 steps |
| Ideogram | pick *Design* or *Realistic*, magic prompt **off** |
| DALL·E / Gemini | just add `wide 16:9 cinematic composition` |
| SDXL | `masterpiece, best quality, highly detailed, 8k`, CFG 6–8 |

---

## Getting them into the site

The wallpapers are currently drawn in code, in `js/scenes.js` — that's why they're limited. To use generated images instead you'd want an image-backed scene list: a `wallpapers/` folder, an array of filenames, and the same crossfade stage swapping `<img>` layers rather than SVG. It's a contained change to `scenes.js` and `main.js`, and the poster type overlay, beat pulse, auto-cycle and PNG export all keep working as they are.

Say the word and I'll wire it — ideally as a hybrid, so the drawn posters stay as instant-loading fallbacks while your generated images become the main set.

---

## Two things to watch

**Hands and faces.** Every model still mangles them. Re-roll rather than fighting it in the prompt, and lean on directions **5** and **7**, which have no faces at all.

**Don't let it write.** Ask for Bengali text and you get convincing-looking nonsense — correct letter shapes, meaningless words. Keep text out of the prompts entirely; the site draws its own type over the top in Baloo Da 2 and Archivo Black.

---

*Written against the site's palette and layout. Untested — I have no image tool here, so these are strong starting points, not one-shot guarantees. Expect to iterate.*

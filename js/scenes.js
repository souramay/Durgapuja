/* ==========================================================================
   scenes.js — the wallpapers.

   Seven flat-vector posters, built as inline SVG: thick outlines, halftone,
   chunky type, sticker badges. Cartoon people doing Puja things. Nothing is
   loaded from anywhere — it is all drawn in markup, so it stays crisp at any
   size and every poster is a few kilobytes.

   A scene is { key, name, sub, tag, svg() }.
   Elements tagged class="pop" scale with the beat.
   ========================================================================== */
(function (global) {
  "use strict";

  var INK = "#1B0E2B";

  /* ----------------------------------------------------------- primitives */

  function bod(d, fill, sw) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + INK +
           '" stroke-width="' + (sw || 9) + '" stroke-linejoin="round" stroke-linecap="round"/>';
  }
  // limb: fat ink stroke underneath, colour on top — the classic outline look
  function ln(d, color, w) {
    return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 16) +
           '" stroke-linecap="round" stroke-linejoin="round"/>' +
           '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w +
           '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function ci(cx, cy, r, fill, sw) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill +
           '" stroke="' + INK + '" stroke-width="' + (sw == null ? 9 : sw) + '"/>';
  }
  function dot(cx, cy, r, fill) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"/>';
  }
  function el(cx, cy, rx, ry, fill, rot, sw) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill +
           '" stroke="' + INK + '" stroke-width="' + (sw == null ? 9 : sw) + '"' +
           (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : "") + "/>";
  }
  /* A CSS `transform` (which every animation class uses) would override the
     SVG transform attribute and throw the element back to the origin, so a
     group that needs both gets nested: placement outside, animation inside. */
  function G(tr, inner, cls) {
    if (tr && cls) return '<g transform="' + tr + '"><g class="' + cls + '">' + inner + "</g></g>";
    if (tr) return '<g transform="' + tr + '">' + inner + "</g>";
    if (cls) return '<g class="' + cls + '">' + inner + "</g>";
    return "<g>" + inner + "</g>";
  }

  /* faces are deliberately minimal — two dots, a blush, a small mouth */
  function face(cx, cy, opt) {
    opt = opt || {};
    var dx = opt.dx == null ? 19 : opt.dx;
    var s = "";
    if (opt.side) {
      s += dot(cx + 14, cy - 2, 7, INK);
    } else {
      s += dot(cx - dx, cy - 2, 7.5, INK) + dot(cx + dx, cy - 2, 7.5, INK);
    }
    s += '<circle cx="' + (cx - dx - 14) + '" cy="' + (cy + 20) + '" r="11" fill="' + (opt.blush || "#FF7A9C") + '" opacity=".75"/>';
    s += '<circle cx="' + (cx + dx + 14) + '" cy="' + (cy + 20) + '" r="11" fill="' + (opt.blush || "#FF7A9C") + '" opacity=".75"/>';
    if (opt.open) {
      s += '<ellipse cx="' + cx + '" cy="' + (cy + 26) + '" rx="13" ry="15" fill="' + INK + '"/>';
    } else {
      s += '<path d="M' + (cx - 15) + ' ' + (cy + 22) + ' q15 16 30 0" fill="none" stroke="' + INK +
           '" stroke-width="7" stroke-linecap="round"/>';
    }
    if (opt.bindi) s += dot(cx, cy - 44, 9, opt.bindi);
    return s;
  }

  /* ------------------------------------------------------------- textures */

  function halftone(id, color, gap, r, op) {
    return '<pattern id="' + id + '" width="' + gap + '" height="' + gap +
           '" patternUnits="userSpaceOnUse">' +
           '<circle cx="' + gap / 2 + '" cy="' + gap / 2 + '" r="' + r + '" fill="' + color +
           '" opacity="' + op + '"/></pattern>';
  }

  function rays(cx, cy, r, n, color, op) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var a2 = a + Math.PI / n * 0.55;
      s += '<path d="M' + cx + ' ' + cy +
           " L" + (cx + Math.cos(a) * r) + " " + (cy + Math.sin(a) * r) +
           " L" + (cx + Math.cos(a2) * r) + " " + (cy + Math.sin(a2) * r) + ' Z" fill="' + color +
           '" opacity="' + op + '"/>';
    }
    return s;
  }

  function garland(x1, y1, x2, y2, sag, n, c1, c2) {
    var s = '<path d="M' + x1 + " " + y1 + " Q" + (x1 + x2) / 2 + " " + (y1 + sag) + " " + x2 + " " + y2 +
            '" fill="none" stroke="' + INK + '" stroke-width="7"/>';
    for (var i = 0; i <= n; i++) {
      var t = i / n, mt = 1 - t;
      var x = mt * mt * x1 + 2 * mt * t * ((x1 + x2) / 2) + t * t * x2;
      var y = mt * mt * y1 + 2 * mt * t * (y1 + sag) + t * t * y2;
      s += ci(x, y, i % 3 === 0 ? 17 : 13, i % 2 ? c1 : c2, 6);
    }
    return s;
  }

  function stars(list, color) {
    return list.map(function (p, i) {
      return G("translate(" + p[0] + "," + p[1] + ") scale(" + (p[2] || 1) + ")",
        '<path d="M0 -22 Q4 -4 22 0 Q4 4 0 22 Q-4 4 -22 0 Q-4 -4 0 -22 Z" fill="' + color + '"/>',
        "a-tw d" + (i % 4));
    }).join("");
  }

  function badge(x, y, rot, text, bg, fg) {
    return G("translate(" + x + "," + y + ") rotate(" + rot + ")",
      '<rect x="-118" y="-34" width="236" height="68" rx="34" fill="' + bg + '" stroke="' + INK + '" stroke-width="8"/>' +
      '<text class="t-badge" x="0" y="12" text-anchor="middle" fill="' + fg + '">' + text + "</text>",
      "a-float");
  }

  /* ======================================================================
     1 · ঢাকের তালে — the dhaki, mid-roll
     ====================================================================== */
  function sceneDhak() {
    var BG = "#FF3B6B", CREAM = "#FFF3E2", GOLD = "#FFC93C", SKIN = "#E8A06A", WHITE = "#FFFBF2";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += G("translate(880,420)", rays(0, 0, 620, 22, GOLD, ".30"), "a-spin");
    s += ci(880, 420, 300, CREAM, 0);
    s += '<rect width="1600" height="1000" fill="url(#ht1)"/>';
    s += garland(-30, 120, 1630, 90, 210, 16, GOLD, "#FF8A3D");

    // ---- dhaki, feet at (880,905)
    var f = "";
    f += ln("M-34 -196 Q-58 -110 -74 -22", "#F2E7D5", 40);         // legs (dhoti-wrapped)
    f += ln("M40 -196 Q70 -108 86 -22", "#F2E7D5", 40);
    f += bod("M-96 -14 q22 -20 46 -6 l6 20 -58 4 Z", "#3A2A1F");   // feet
    f += bod("M64 -14 q26 -18 48 -2 l2 18 -56 2 Z", "#3A2A1F");
    f += bod("M-70 -410 q70 -34 140 0 l30 200 q-100 34 -200 0 Z", "#E63946");  // kurta
    f += bod("M-40 -418 q40 40 80 0 l-16 -22 -48 0 Z", "#C2182D");            // collar
    f += ln("M-96 -260 Q-30 -300 34 -262", "#F7EFE0", 22);                    // gamchha
    // arms — the near one raised with a stick
    f += ln("M-64 -382 Q-160 -330 -186 -236", SKIN, 34);
    f += ln("M62 -384 Q168 -352 196 -262", SKIN, 34);
    f += ci(0, -470, 62, SKIN, 9);                                            // head
    f += bod("M-64 -488 q28 -74 92 -56 q34 8 34 46 q-30 -30 -70 -20 q-34 8 -56 30 Z", "#241A2E"); // hair
    f += face(0, -470, { open: true, blush: "#F2708F" });
    // drum, slung across the body
    var drum = el(0, 0, 118, 96, "#F6EBDA", -8, 10) +
               '<ellipse cx="0" cy="0" rx="118" ry="96" fill="none" stroke="' + INK + '" stroke-width="10" transform="rotate(-8)"/>' +
               el(0, 0, 82, 66, "#EFDFC6", -8, 8) +
               dot(0, 0, 26, "#4A2E1B") +
               // rope lacing
               (function () {
                 var o = "";
                 for (var i = 0; i < 12; i++) {
                   var a1 = (i / 12) * Math.PI * 2, a2 = ((i + 1.4) / 12) * Math.PI * 2;
                   o += '<path d="M' + (Math.cos(a1) * 88) + " " + (Math.sin(a1) * 72) +
                        " L" + (Math.cos(a2) * 122) + " " + (Math.sin(a2) * 100) +
                        '" stroke="#B98A4E" stroke-width="6" fill="none"/>';
                 }
                 return o;
               })();
    f += G("translate(6,-250)", drum, "pop");
    // feathers
    f += G("translate(-40,-372)",
      bod("M0 0 q-40 -70 -8 -128 q34 56 8 128 Z", WHITE) +
      bod("M26 6 q-16 -80 26 -124 q-6 74 -26 124 Z", "#FF8A3D") +
      bod("M-30 6 q-44 -58 -34 -118 q42 46 34 118 Z", GOLD), "a-sway");
    // sticks
    f += ln("M-186 -236 L-252 -300", "#8B5E34", 13);
    f += ln("M196 -262 L262 -318", "#8B5E34", 13);
    s += G("translate(880,905)", f, "a-bob");

    // sound rings off the drum
    s += G("translate(886,655)",
      '<circle r="150" fill="none" stroke="' + CREAM + '" stroke-width="10" class="a-ring d0"/>' +
      '<circle r="150" fill="none" stroke="' + GOLD + '" stroke-width="10" class="a-ring d1"/>' +
      '<circle r="150" fill="none" stroke="' + CREAM + '" stroke-width="10" class="a-ring d2"/>');

    s += badge(1330, 250, -12, "NON-STOP ↻", GOLD, INK);
    return s;
  }

  /* ======================================================================
     2 · ধুনুচি নাচ — dancer with two smoking pots
     ====================================================================== */
  function sceneDhunuchi() {
    var BG = "#2B1B5E", GLOW = "#FFC93C", ORANGE = "#FF6B35", CREAM = "#FFF3E2", SKIN = "#D98E5F";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += '<rect width="1600" height="1000" fill="url(#g2)"/>';
    s += ci(1290, 210, 118, CREAM, 0) + ci(1246, 186, 100, BG, 0);
    s += stars([[190, 150, 1], [420, 96, .7], [1060, 130, .85], [700, 190, .6], [1500, 420, .8], [120, 420, .65]], GLOW);
    s += '<rect width="1600" height="1000" fill="url(#ht2)"/>';

    // crowd silhouettes
    var crowd = "";
    for (var i = 0; i < 16; i++) {
      var x = 40 + i * 104 + (i % 3) * 18, hh = 120 + (i % 4) * 26;
      crowd += bod("M" + x + " 1000 v-" + hh + " q0 -46 44 -46 q44 0 44 46 v" + hh + " Z", "#160C33", 0);
      crowd += '<circle cx="' + (x + 44) + '" cy="' + (1000 - hh - 62) + '" r="30" fill="#160C33"/>';
    }
    s += G("translate(0,120)", crowd);

    // ---- dancer, feet at (800,880)
    var f = "";
    f += ln("M-30 -180 Q-84 -104 -118 -34", SKIN, 34);
    f += ln("M36 -180 Q92 -110 120 -40", SKIN, 34);
    // saree — wide swinging drape
    f += bod("M-96 -380 q96 -40 192 0 l86 236 q-186 60 -364 0 Z", "#E01A4F");
    f += bod("M-96 -380 q96 -40 192 0 l14 40 q-110 34 -220 0 Z", CREAM);
    f += '<path d="M-178 -144 q178 62 364 0 l10 26 q-192 66 -384 0 Z" fill="' + CREAM + '"/>';
    f += ln("M-88 -348 Q-140 -250 -120 -150", CREAM, 16);         // anchal
    f += ln("M-72 -368 Q-176 -448 -212 -534", SKIN, 32);          // arms up
    f += ln("M72 -368 Q176 -448 212 -534", SKIN, 32);
    f += ci(0, -444, 58, SKIN, 9);
    f += bod("M-60 -462 q26 -70 86 -52 q32 10 32 44 q-28 -26 -66 -18 q-32 8 -52 26 Z", "#1E1230");
    f += ci(-64, -424, 26, "#1E1230", 8);                          // bun
    f += face(0, -444, { open: true, bindi: "#E01A4F", blush: "#FF6E8A" });

    // pots + smoke
    function pot(x, y) {
      return G("translate(" + x + "," + y + ")",
        bod("M-46 0 l16 -54 h60 l16 54 Z", "#8A4B2A") +
        el(0, -56, 48, 16, "#B4673A", 0, 8) +
        G("", '<circle r="34" fill="' + GLOW + '" opacity=".95"/><circle r="18" fill="#FFF6D8"/>', "pop") +
        G("translate(0,-70)",
          '<path d="M0 0 q-40 -70 -6 -140 q34 -76 -10 -150" fill="none" stroke="' + CREAM + '" stroke-width="16" stroke-linecap="round" opacity=".5" class="a-smoke d0"/>' +
          '<path d="M14 0 q42 -66 12 -136 q-30 -70 12 -134" fill="none" stroke="' + CREAM + '" stroke-width="12" stroke-linecap="round" opacity=".35" class="a-smoke d2"/>')
      );
    }
    f += pot(-232, -540) + pot(232, -540);
    s += G("translate(800,880)", f, "a-sway");

    s += badge(1300, 640, 9, "SMOKE + BASS", ORANGE, CREAM);
    return s;
  }

  /* ======================================================================
     3 · প্যান্ডেল হপিং — three friends walking
     ====================================================================== */
  function scenePandal() {
    var BG = "#FFD166", RED = "#E63946", CREAM = "#FFF7E8", TEAL = "#118AB2", SKIN1 = "#F0B088", SKIN2 = "#C97B45";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    // pandal arch
    s += bod("M170 1000 V440 q0 -270 630 -270 q630 0 630 270 V1000 h-150 V450 q0 -160 -480 -160 q-480 0 -480 160 V1000 Z", RED);
    s += bod("M800 96 l40 78 h-80 Z", CREAM);
    s += ci(800, 208, 46, CREAM, 9) + ci(800, 208, 22, RED, 0);
    for (var k = 0; k < 9; k++) {
      s += bod("M" + (300 + k * 150) + " 262 l26 -50 26 50 Z", CREAM, 7);
    }
    s += '<rect width="1600" height="1000" fill="url(#ht3)"/>';
    // string lights
    s += garland(-30, 300, 1630, 280, 150, 20, CREAM, TEAL);

    function walker(x, sc, outfit, skin, hair, hairStyle, bag) {
      var f = "";
      f += ln("M-16 -168 Q-52 -96 -70 -26", "#2A2136", 30);
      f += ln("M22 -168 Q58 -100 78 -26", "#2A2136", 30);
      f += bod("M-88 -22 q26 -18 50 -4 l4 18 -60 4 Z", "#F2F2F2", 7);
      f += bod("M62 -22 q26 -18 50 -4 l4 18 -60 4 Z", "#F2F2F2", 7);
      f += bod("M-64 -344 q64 -30 128 0 l18 182 q-84 30 -164 0 Z", outfit);
      f += ln("M-58 -330 Q-118 -246 -104 -170", skin, 28);
      f += ln("M58 -330 Q116 -250 106 -172", skin, 28);
      f += ci(0, -404, 54, skin, 9);
      if (hairStyle === "bun") {
        f += bod("M-56 -422 q24 -66 80 -48 q30 10 30 42 q-26 -24 -62 -16 q-30 8 -48 22 Z", hair);
        f += ci(0, -470, 26, hair, 8);
      } else if (hairStyle === "long") {
        f += bod("M-58 -420 q26 -70 84 -50 q32 12 30 46 l10 108 -34 6 -8 -104 q-40 18 -84 -6 Z", hair);
      } else {
        f += bod("M-56 -424 q28 -60 84 -42 q28 10 26 40 q-30 -22 -66 -14 q-28 8 -44 16 Z", hair);
      }
      f += face(0, -404, { blush: "#FF8DA6", bindi: hairStyle === "short" ? null : RED });
      if (bag) f += bod("M62 -300 q40 6 44 44 l6 62 -56 6 -8 -66 Z", TEAL, 8);
      return G("translate(" + x + ",900) scale(" + sc + ")", f);
    }

    s += G("", walker(470, 1.0, TEAL, SKIN2, "#20182E", "long", false), "a-walk d1");
    s += G("", walker(800, 1.12, CREAM, SKIN1, "#2E1F14", "bun", true), "a-walk d0");
    s += G("", walker(1120, .98, "#FF6B35", SKIN2, "#20182E", "short", false), "a-walk d2");

    s += badge(1310, 430, -7, "1.2 KM QUEUE", CREAM, INK);
    return s;
  }

  /* ======================================================================
     4 · সেলফি স্কোয়াড
     ====================================================================== */
  function sceneSelfie() {
    var BG = "#A8E10C", PINK = "#FF3B6B", CREAM = "#FFF7E8", PURPLE = "#6C4AB6";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += G("translate(800,470)", '<circle r="360" fill="' + PINK + '"/>', "pop");
    s += ci(800, 470, 296, CREAM, 10);
    s += '<rect width="1600" height="1000" fill="url(#ht4)"/>';
    s += stars([[250, 250, 1.6], [1340, 300, 1.3], [200, 700, 1.1], [1400, 720, 1.5], [1120, 150, .9]], PURPLE);

    function head(x, y, sc, skin, hair, style, rot) {
      var f = ci(0, 0, 76, skin, 10);
      if (style === "bun") {
        f += bod("M-78 -22 q34 -92 112 -66 q42 14 42 58 q-36 -34 -86 -22 q-42 12 -68 30 Z", hair);
        f += ci(4, -84, 34, hair, 9);
      } else if (style === "long") {
        f += bod("M-80 -20 q36 -98 118 -70 q44 16 42 64 l14 150 -48 8 -10 -146 q-56 26 -116 -6 Z", hair);
      } else {
        f += bod("M-78 -28 q40 -84 118 -58 q40 14 36 56 q-42 -30 -92 -20 q-40 12 -62 22 Z", hair);
      }
      f += face(0, 0, { dx: 26, blush: "#FF6E8A", bindi: style === "short" ? null : PINK });
      return G("translate(" + x + "," + y + ") scale(" + sc + ") rotate(" + (rot || 0) + ")", f);
    }

    s += G("translate(0,0)",
      head(600, 480, 1, "#C97B45", "#20182E", "long", -8) +
      head(800, 430, 1.1, "#F0B088", "#2E1F14", "bun", 3) +
      head(1000, 490, .96, "#8C5A33", "#1B1226", "short", 9), "a-bob");

    // outstretched arm + phone
    s += ln("M1060 560 Q1240 520 1300 380", "#C97B45", 40);
    s += G("translate(1316,352) rotate(18)",
      '<rect x="-56" y="-96" width="112" height="192" rx="18" fill="' + INK + '"/>' +
      '<rect x="-44" y="-82" width="88" height="152" rx="8" fill="#8FD9FF"/>' +
      dot(0, 82, 8, "#6A6A6A"), "a-float");
    s += G("translate(1316,352)",
      '<circle r="120" fill="none" stroke="' + CREAM + '" stroke-width="8" class="a-ring d1"/>');

    s += badge(300, 880, -6, "📸 ×247", CREAM, INK);
    return s;
  }

  /* ======================================================================
     5 · বাসে করে ঠাকুর দেখা — the bus, and the man with the whistle
     ====================================================================== */
  function sceneBus() {
    var BG = "#00A6A6", CREAM = "#FFF7E8", ORANGE = "#FF9F1C", RED = "#E63946", GLASS = "#BFE9F2";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += G("translate(240,240)", rays(0, 0, 520, 18, CREAM, ".16"), "a-spin");
    s += '<rect y="720" width="1600" height="280" fill="#0A6E70"/>';
    s += '<rect width="1600" height="1000" fill="url(#ht5)"/>';

    // skyline
    for (var i = 0; i < 7; i++) {
      var bx = 60 + i * 240, bh = 150 + (i % 3) * 80;
      s += bod("M" + bx + " 720 v-" + bh + " h140 v" + bh + " Z", "#0B7C7E", 0);
    }

    var bus = "";
    bus += bod("M-620 120 q-40 0 -40 -40 V-160 q0 -60 60 -60 H430 q40 0 62 34 l96 148 q22 26 22 60 V80 q0 40 -40 40 Z", CREAM);
    bus += '<rect x="-660" y="30" width="1220" height="26" fill="' + RED + '"/>';
    // windows with passengers
    var faces = [["#F0B088", "#2E1F14"], ["#C97B45", "#20182E"], ["#8C5A33", "#1B1226"], ["#F0B088", "#3A2416"]];
    for (var w = 0; w < 4; w++) {
      var wx = -580 + w * 250;
      bus += '<rect x="' + wx + '" y="-150" width="200" height="150" rx="16" fill="' + GLASS + '" stroke="' + INK + '" stroke-width="9"/>';
      var fc = faces[w];
      bus += G("translate(" + (wx + 100) + ",-52)",
        ci(0, 0, 46, fc[0], 8) +
        bod("M-48 -14 q22 -56 72 -40 q26 10 24 36 q-26 -20 -56 -12 q-26 8 -40 16 Z", fc[1]) +
        face(0, 0, { dx: 15, blush: "#FF8DA6" }), w % 2 ? "a-bob d1" : "a-bob d3");
    }
    // route board
    bus += '<rect x="180" y="-206" width="330" height="56" rx="12" fill="' + INK + '"/>';
    bus += '<text class="t-route" x="345" y="-166" text-anchor="middle" fill="' + ORANGE + '">24 · SHYAMBAZAR</text>';
    bus += ci(-500, 120, 74, "#221A2E", 9) + ci(-500, 120, 30, "#8A8A95", 6);
    bus += ci(380, 120, 74, "#221A2E", 9) + ci(380, 120, 30, "#8A8A95", 6);
    // conductor hanging out of the door
    bus += G("translate(560,-40)",
      ln("M-10 60 Q60 30 96 -34", "#C97B45", 30) +
      bod("M-56 100 q56 -26 112 0 l14 96 q-70 26 -140 0 Z", ORANGE) +
      ci(0, 20, 52, "#C97B45", 9) +
      bod("M-54 2 q26 -64 82 -46 q30 10 28 40 q-28 -22 -64 -14 q-28 8 -46 20 Z", "#1B1226") +
      face(0, 20, { dx: 17, open: true, blush: "#FF8DA6" }) +
      bod("M96 -34 l44 -18 8 22 -44 18 Z", "#F2F2F2", 6), "a-sway");
    // marigold garland on the front
    bus += garland(-640, -190, 170, -190, 90, 12, ORANGE, "#FFD166");
    s += G("translate(760,600) scale(1.02)", bus, "a-bob");

    // speaker + notes
    s += G("translate(180,830)",
      '<rect x="-70" y="-110" width="140" height="220" rx="18" fill="' + INK + '"/>' +
      ci(0, -46, 40, "#3A2F4F", 6) + ci(0, 48, 26, "#3A2F4F", 6), "pop");
    s += G("translate(300,700)",
      '<text class="t-note a-float d0" x="0" y="0" fill="' + CREAM + '">♪</text>' +
      '<text class="t-note a-float d2" x="70" y="-70" fill="' + ORANGE + '">♫</text>');

    s += badge(1330, 200, 8, "ORE DADA, EGIYE!", ORANGE, INK);
    return s;
  }

  /* ======================================================================
     6 · সিঁদুর খেলা
     ====================================================================== */
  function sceneSindoor() {
    var BG = "#FFF3E2", RED = "#E01A4F", DEEP = "#2B1B5E", SKIN1 = "#F0B088", SKIN2 = "#C97B45";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += G("translate(800,440)", '<circle r="330" fill="' + RED + '"/>', "pop");
    s += '<rect width="1600" height="1000" fill="url(#ht6)"/>';

    // powder bursts
    function burst(x, y, sc, color, cls) {
      var o = "";
      for (var i = 0; i < 22; i++) {
        var a = (i / 22) * Math.PI * 2 + i, r = 40 + (i % 5) * 44;
        o += '<circle cx="' + (Math.cos(a) * r) + '" cy="' + (Math.sin(a) * r * .8) + '" r="' + (7 + (i % 4) * 6) +
             '" fill="' + color + '" opacity="' + (0.32 + (i % 3) * 0.16) + '"/>';
      }
      return G("translate(" + x + "," + y + ") scale(" + sc + ")", o, cls);
    }
    s += burst(800, 400, 1.5, "#FF5C7A", "a-burst d0");
    s += burst(560, 520, 1.0, RED, "a-burst d2");
    s += burst(1060, 480, 1.15, "#FF7A50", "a-burst d1");

    function woman(x, sc, flip, skin, hair) {
      var f = "";
      f += bod("M-104 -368 q104 -42 208 0 l72 340 q-190 56 -352 0 Z", "#FFFBF2");
      f += '<path d="M-176 -32 q196 62 384 0 l10 30 q-204 66 -404 0 Z" fill="' + RED + '"/>';
      f += ln("M-96 -338 Q-160 -230 -140 -110", RED, 20);
      f += ln("M-74 -352 Q-190 -410 -240 -470", skin, 32);
      f += ln("M74 -352 Q188 -404 232 -462", skin, 32);
      f += ci(0, -430, 58, skin, 9);
      f += bod("M-60 -448 q26 -70 86 -52 q32 10 32 44 q-28 -26 -66 -18 q-32 8 -52 26 Z", hair);
      f += ci(-62, -410, 26, hair, 8);
      f += face(0, -430, { open: true, bindi: RED, blush: "#FF6E8A" });
      // sindoor smudge on the cheek
      f += '<ellipse cx="34" cy="-408" rx="22" ry="13" fill="' + RED + '" opacity=".8" transform="rotate(-14 34 -408)"/>';
      return G("translate(" + x + ",880) scale(" + (flip ? -sc : sc) + "," + sc + ")", f);
    }
    s += G("", woman(560, 1.0, false, SKIN1, "#2E1F14"), "a-sway d0");
    s += G("", woman(1050, 1.04, true, SKIN2, "#20182E"), "a-sway d2");

    s += badge(1320, 800, -8, "আসছে বছর আবার", RED, "#FFF7E8");
    return s;
  }

  /* ======================================================================
     7 · লো-ফাই পুজো — the rooftop, headphones on
     ====================================================================== */
  function sceneLofi() {
    var BG = "#150C22", PURPLE = "#6C4AB6", GOLD = "#FFC93C", CREAM = "#FFF3E2", PINK = "#FF6B9D";
    var s = '<rect width="1600" height="1000" fill="' + BG + '"/>';
    s += '<rect width="1600" height="1000" fill="url(#g7)"/>';
    s += ci(1200, 240, 130, GOLD, 0);
    s += stars([[220, 180, 1.2], [520, 120, .8], [860, 210, .9], [1480, 480, 1], [140, 520, .7], [980, 90, .6]], CREAM);
    s += '<rect width="1600" height="1000" fill="url(#ht7)"/>';

    // pandal skyline
    for (var i = 0; i < 6; i++) {
      var bx = 40 + i * 280, bh = 200 + (i % 3) * 90;
      s += bod("M" + bx + " 760 v-" + bh + " q0 -70 110 -70 q110 0 110 70 v" + bh + " Z", PURPLE, 0);
      s += '<circle cx="' + (bx + 110) + '" cy="' + (760 - bh - 96) + '" r="16" fill="' + GOLD + '" class="a-tw d' + (i % 4) + '"/>';
    }
    // rooftop parapet
    s += '<rect y="760" width="1600" height="240" fill="#241539"/>';
    s += '<rect y="742" width="1600" height="34" fill="#311D4C" stroke="' + INK + '" stroke-width="8"/>';

    // seated figure, side view
    var f = "";
    f += bod("M-30 -30 q120 -22 200 -6 l6 40 -210 10 Z", "#2A2136");        // legs out
    f += ln("M150 8 L212 12", "#F2F2F2", 26);
    f += bod("M-96 -232 q76 -34 148 -6 l24 216 q-108 30 -196 0 Z", PINK);   // hoodie
    f += ln("M40 -180 Q136 -140 152 -66", "#C97B45", 30);                    // arm to knee
    f += ci(-6, -300, 60, "#C97B45", 9);
    f += bod("M-66 -318 q28 -72 90 -54 q34 10 32 44 q-30 -26 -68 -18 q-32 8 -54 28 Z", "#1B1226");
    f += face(-6, -300, { side: true, blush: "#FF8DA6" });
    // headphones
    f += '<path d="M-72 -320 q66 -76 132 0" fill="none" stroke="' + INK + '" stroke-width="18" stroke-linecap="round"/>';
    f += '<path d="M-72 -320 q66 -76 132 0" fill="none" stroke="' + GOLD + '" stroke-width="9" stroke-linecap="round"/>';
    f += G("translate(-74,-306)", '<rect x="-20" y="-28" width="40" height="60" rx="18" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="8"/>', "pop");
    f += G("translate(62,-306)", '<rect x="-20" y="-28" width="40" height="60" rx="18" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="8"/>', "pop");
    // chai
    f += G("translate(214,-16)",
      bod("M-26 0 l6 -52 h40 l6 52 Z", CREAM) +
      '<path d="M-6 -66 q-18 -26 0 -50" fill="none" stroke="' + CREAM + '" stroke-width="7" stroke-linecap="round" opacity=".6" class="a-smoke d1"/>');
    s += G("translate(560,880) scale(1.15)", f, "a-bob");

    // floating cassette
    s += G("translate(1180,600) rotate(-10)",
      '<rect x="-130" y="-84" width="260" height="168" rx="16" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="9"/>' +
      '<rect x="-98" y="-56" width="196" height="66" rx="8" fill="' + PURPLE + '" stroke="' + INK + '" stroke-width="7"/>' +
      ci(-46, -22, 22, CREAM, 7) + ci(46, -22, 22, CREAM, 7) +
      '<text class="t-tape" x="0" y="58" text-anchor="middle" fill="' + INK + '">PUJO MIX ’25</text>', "a-float");

    s += badge(320, 250, -10, "24/7 STREAM", PINK, INK);
    return s;
  }

  /* ---------------------------------------------------------- the posters */

  var SCENES = [
    { key: "dhak",     name: "ঢাকের তালে",   sub: "Dhaak Drop", tag: "PUJO SOUNDSYSTEM · VOL. 1",        svg: sceneDhak,      ht: ["ht1", "#1B0E2B", 26, 3.2, ".13"] },
    { key: "dhunuchi", name: "ধুনুচি নাচ",    sub: "Dhunuchi Nights", tag: "ASHTAMI · 11:47 PM",   svg: sceneDhunuchi,  ht: ["ht2", "#FFC93C", 30, 3, ".12"] },
    { key: "pandal",   name: "প্যান্ডেল হপিং", sub: "Pandal Hopping", tag: "DAY 4 · 9 PANDALS · 0 REGRETS",    svg: scenePandal,    ht: ["ht3", "#1B0E2B", 24, 3, ".12"] },
    { key: "selfie",   name: "সেলফি স্কোয়াড",  sub: "Selfie Squad", tag: "ONE MORE, LAST ONE, PROMISE",      svg: sceneSelfie,    ht: ["ht4", "#1B0E2B", 26, 3.4, ".11"] },
    { key: "bus",      name: "বাসে করে",     sub: "Route 24", tag: "CONDUCTOR’S PLAYLIST · ALL KILLER",          svg: sceneBus,       ht: ["ht5", "#03343A", 28, 3.2, ".14"] },
    { key: "sindoor",  name: "সিঁদুর খেলা",    sub: "Sindoor Khela", tag: "DASHAMI · SEE YOU NEXT YEAR, MA",     svg: sceneSindoor,   ht: ["ht6", "#2B1B5E", 26, 3, ".10"] },
    { key: "lofi",     name: "লো-ফাই পুজো",   sub: "Lo-fi Pujo", tag: "BEATS TO PANDAL-HOP / DO NOTHING TO",        svg: sceneLofi,      ht: ["ht7", "#FFC93C", 32, 2.8, ".10"] }
  ];

  function buildSVG(scene) {
    var h = scene.ht;
    var defs = "<defs>" + halftone(h[0], h[1], h[2], h[3], h[4]) +
      '<radialGradient id="g2" cx="50%" cy="30%" r="70%">' +
        '<stop offset="0%" stop-color="#4A2E8F" stop-opacity=".85"/>' +
        '<stop offset="100%" stop-color="#2B1B5E" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="g7" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#3B1F5E"/>' +
        '<stop offset="100%" stop-color="#150C22"/></linearGradient>' +
      "</defs>";

    return '<svg class="poster" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" ' +
           'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + defs + scene.svg() + "</svg>";
  }

  /* =====================================================================
     Stage — two layers, crossfaded. Beat scales anything tagged .pop.
     ===================================================================== */
  function Stage(root, opts) {
    opts = opts || {};
    this.root = root;
    this.scenes = SCENES;
    this.i = -1;
    this.hold = opts.sceneSeconds || 18;
    this.fade = (opts.fadeSeconds || 1.1) * 1000;
    this.auto = opts.autoCycle !== false;
    this.onScene = opts.onScene || function () {};

    this.layers = [document.createElement("div"), document.createElement("div")];
    this.layers.forEach(function (l) { l.className = "layer"; root.appendChild(l); });
    this.front = 0;

    this.timer = null;
    this.busy = false;
  }

  Stage.prototype.show = function (idx, instant) {
    var n = this.scenes.length;
    idx = ((idx % n) + n) % n;
    if (idx === this.i || this.busy) return;

    var self = this;
    var scene = this.scenes[idx];
    var back = this.layers[1 - this.front];

    back.innerHTML = buildSVG(scene);
    back.style.transitionDuration = (instant ? 0 : this.fade) + "ms";
    this.layers[this.front].style.transitionDuration = (instant ? 0 : this.fade) + "ms";

    // force a reflow so the transition actually runs
    void back.offsetWidth;

    this.busy = true;
    back.classList.add("is-on");
    this.layers[this.front].classList.remove("is-on");

    var old = this.front;
    this.front = 1 - this.front;
    this.i = idx;
    this.onScene(scene, idx);

    setTimeout(function () {
      self.layers[old].innerHTML = "";
      self.busy = false;
    }, instant ? 30 : this.fade + 60);

    this.restart();
  };

  Stage.prototype.go = function (d) { this.show(this.i + d); };

  Stage.prototype.restart = function () {
    var self = this;
    clearTimeout(this.timer);
    if (!this.auto) return;
    this.timer = setTimeout(function () { self.go(1); }, this.hold * 1000);
  };

  Stage.prototype.setAuto = function (on) {
    this.auto = !!on;
    if (on) this.restart(); else clearTimeout(this.timer);
  };

  Stage.prototype.current = function () { return this.scenes[this.i]; };

  Stage.prototype.beat = function (v) {
    this.root.style.setProperty("--beat", (1 + v * 0.07).toFixed(3));
  };

  /* Rasterise the live poster. External fonts do not survive serialisation,
     so the type falls back — everything else exports exactly as drawn. */
  Stage.prototype.savePNG = function (done) {
    var svg = this.layers[this.front].querySelector("svg");
    if (!svg) return;
    var W = 2560, H = 1600;
    var clone = svg.cloneNode(true);
    clone.setAttribute("width", W);
    clone.setAttribute("height", H);

    var src = new XMLSerializer().serializeToString(clone);
    var img = new Image();
    var self = this;
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d").drawImage(img, 0, 0, W, H);
      var a = document.createElement("a");
      a.download = "sharodiya-" + self.current().key + ".png";
      a.href = c.toDataURL("image/png");
      document.body.appendChild(a); a.click(); a.remove();
      done && done(true);
    };
    img.onerror = function () { done && done(false); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
  };

  global.Scenes = { list: SCENES, Stage: Stage, build: buildSVG };
})(window);

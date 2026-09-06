/* ============================================================
   শারদীয়া — music configuration.

   The queue below is what plays. Visitors never see an input box,
   and the player shows no titles — this file is just the source
   of truth for what's in rotation.

   To swap in a whole YouTube playlist instead, put its ID in
   PLAYLIST (the bit after "list=" in a playlist URL) — when that
   is set, it wins and TRACKS is ignored.

   Adding songs in bulk?  node tools/make-tracks.mjs links.txt
   ============================================================ */

/* ---- LOCAL FILES — the most reliable source ----------------
   Drop audio into the music/ folder and list it here. These play
   from your own server, so nothing can block them, and the
   visualiser runs off the real waveform.
   Takes priority over PLAYLIST and TRACKS below.
   See music/README.md.                                        */
var LOCAL = [
  // { file: "dhaker-taal.mp3", title: "Dhaker Taal", artist: "" },
];

/* ---- BACKGROUND ------------------------------------------
   What sits behind everything. Three options:

     ""            the drawn posters (default)
     "media/x.mp4" a video or .gif from the media/ folder
     "youtube"     the music video itself, full-bleed

   The 🎞 button in the top bar toggles it at any time, and
   ?bg=youtube / ?bg=media/x.mp4 overrides this per visit.    */
var BACKGROUND = "media/ascii-magic.mp4";

var PLAYLIST = "";

/* ---- the queue --------------------------------------------
   "id" is the part after "watch?v=". Titles and artists are
   labels for you, not shown anywhere on the site.
   Anything that refuses to embed is skipped automatically.   */
var TRACKS = [
  /* --- modern / crowd favourites first --- */
  { id: "4Vli8y0SE_E", title: "Elo Elo Maa Bolo Durga Durga",       artist: "Rajashri Bag" },
  { id: "e2Ap7GTCW2o", title: "Alote Hasite Durga Maa",             artist: "Rajashri Bag & Sanju Kumar" },
  { id: "uGRpMREPAOo", title: "Joy Joy Durga",                      artist: "Swagatalakshmi Dasgupta" },
  { id: "3E_qefwPA0E", title: "Joy Joy Durga Maa",                  artist: "Jeet Gannguli, Shaan, Abhijeet" },
  { id: "9Hmp6u1cx3I", title: "Dhak Baja Kashor Baja",             artist: "Shreya Ghoshal" },
  { id: "XyatKcoBrPw", title: "Bolo Dugga Elo",                    artist: "Sunidhi Chauhan, Nakash Aziz" },
  { id: "xlElO06nQy8", title: "Dugga Elo",                          artist: "Monali Thakur" },
  { id: "VL8EAkTiQMg", title: "Aschhen Ma Durga",                   artist: "Kharaj Mukherjee" },
  { id: "NDu0g-b9eAw", title: "Ma Go Durga Ma Go",                 artist: "Raghab Chatterjee" },
  { id: "ofS5KNgC3mw", title: "Ogo Durga Maa",                      artist: "Saikat Mitra" },
  { id: "tZKOQg7AxHE", title: "Toke Jodi Na Daki Ma",              artist: "Swagatalakshmi Dasgupta" },
  { id: "IYbuA0FyF90", title: "Jani Tumi Achho Ma Go",             artist: "Saikat Mitra" },
  { id: "JtpoXa8oa4k", title: "Anek Bytha Niye",                   artist: "Sriradha Banerjee" },
  { id: "IISWE2RiDBU", title: "Bajlo Tomar Alor Benu",              artist: "Debolinaa Nandy" },
  { id: "IfSJy3_Lkuo", title: "Jago Durga Dashapraharanadharinee",  artist: "Dwijen Mukherjee" },
  { id: "45O8KBhSZ0I", title: "Durge Durge Durgatinashini",         artist: "Asha Bhosle" },
  { id: "2RZZzJdzGPM", title: "Ogo Amar Agamani Alo",               artist: "Sipra Bose" },
  { id: "sF9pYWdj4gE", title: "O Ma Danujdalani Mahashakti",        artist: "Indrani Sen" },
  { id: "F_IWrE12214", title: "Dashabhuje Dashapraharanadharini",   artist: "Arati Mukherjee" },
  { id: "E0xfnngGo5Y", title: "Ya Chandi — He Chinmoyi Durga",      artist: "Tarun Banerjee" },
  { id: "zlkuSUNNazA", title: "Trinayanee Maa",                     artist: "Manna Dey" },
  { id: "SGsraszLnFE", title: "Joy Jagajjanani",                    artist: "Madhuri Mukherjee" },
  { id: "9McWGBOuJyw", title: "Jayanti Mangala Kali",               artist: "Pankaj Kumar Mullick" },
  { id: "69qdaTKx1WY", title: "Jagao Narayani Maa Jago",            artist: "Atanu Sanyal · Ruby Gupta" },
  { id: "p5dwyg7luFg", title: "Adham Santaner Prati Karo Karuna",   artist: "Amar Paul" },
  { id: "cvy9vpbFi8k", title: "Korechhi Pujar Aayojan",             artist: "Ramkumar Chatterjee" },
  { id: "nhqPV_VIKLU", title: "Jao Jao Giriraj",                    artist: "Manju Das" },
  { id: "XkPrietm2QU", title: "Ananda Mate Girirajpuri",            artist: "Chandrabali Rudra" },
  { id: "iMJzZhZbPbM", title: "Barsha Gelo Aswin Elo",              artist: "Nirmal Mukherjee" },
  { id: "TKizNkA5dvE", title: "O Maa Dashabhujaa",                  artist: "Swapna Chakraborty" },

  /* --- Mahalaya --- */
  { id: "YQyo8QeoYhc", title: "Mahishasura Mardini",                artist: "Birendra Krishna Bhadra" },
  { id: "p9YkDeTij90", title: "Ya Devi Sarvabhuteshu",              artist: "Om Voices" },
  { id: "442ewPgXHQ0", title: "Aigiri Nandini",                     artist: "Rajalakshmee Sanjay" }

  /* Removed: 2p-W8o0d-s4 "Aji Shankhe Shankhe Mangala Gao" — YouTube
     returned error 150: the owner has embedding switched off, so it
     cannot play on any site. No point asking for it. */
];

/* ---- everything else has a sensible default ---------------- */
window.SHARODIYA_CONFIG = {
  background: BACKGROUND,
  local: LOCAL,
  playlist: PLAYLIST,
  tracks: TRACKS,

  shuffle: true,       // jumble the queue on load
  volume: 80,          // 0-100
  sceneSeconds: 18,    // how long each poster is held
  fadeSeconds: 1.1,    // crossfade between posters
  ensembleTempo: 96,   // BPM of the fallback dhak ensemble

  // Supabase Ads & Client Analytics (Public Anon Key)
  supabase: {
    url: "https://bwruqavaexkciiuydgmg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cnVxYXZhZXhrY2lpdXlkZ21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzMzNzQsImV4cCI6MjEwNDI0OTM3NH0.Ussc8Yip93_vZ1RZHJVcDprN8ru8OeRkXhybWYH-YGM"
  }
};

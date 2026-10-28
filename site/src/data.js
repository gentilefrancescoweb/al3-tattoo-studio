// Everything brand-specific lives here. Facts come from @al3tattoostudio and
// @sgt.zippo (studied 2026-10-18); lines marked PLACEHOLDER are drafts for the
// owner to review (see BRIEF.md §2, open item 4).

export const PRIVACY_UPDATED = "25 ottobre 2026";

export const STUDIO = {
  name: "AL3 Tattoo Studio",
  artist: "Sgt. Zippo",
  address: "Via Mazzini 10/c, Biella",
  // Italian law: a VAT-registered business shows its Partita IVA on its website. Both from the owner (round 8);
  // while empty the page shows a "da inserire" marker and verify.mjs fails, so it cannot ship half-done
  vat: "", // PLACEHOLDER: Partita IVA, 11 digits
  privacyEmail: "", // PLACEHOLDER: where privacy requests go
  mapsUrl: "https://maps.app.goo.gl/fw5NLr9mtjjSzXzt7",
  phoneDisplay: "015 247 0107",
  phoneTel: "+390152470107",
  whatsapp: "390152470107",
  igStudio: "https://www.instagram.com/al3tattoostudio/",
  igArtist: "https://www.instagram.com/sgt.zippo/",
  zone: "Europe/Rome",
  // Tuesday (2) to Saturday (6), 14:30–19:00
  hours: { days: [2, 3, 4, 5, 6], open: [14, 30], close: [19, 0] },
  // one-off openings that override the weekly hours (date in Rome time)
  specials: [{ date: "2026-10-31", open: [14, 0], close: [20, 0], label: "Walk-in di Halloween" }],
};

export const waLink = (text = "Ciao Zippo! Vorrei informazioni per un tatuaggio.") =>
  `https://wa.me/${STUDIO.whatsapp}?text=${encodeURIComponent(text)}`;

export const LOADER_LINES = [
  "Virtus virescit vulnere.",
  "100% good habits.",
  "Tattoo · Piercing · Industry.",
  "Insomma… quasi pronto.", // PLACEHOLDER — in his "Insomma…" register
];

// Styles: the archive filters and the chapter stage share these keys. The chapter cards are only his drawings from
// assets/da zippo (owner, round 8: "Stili: the 4 styles" use only designs from that folder); "Vedi i lavori" still opens the tattoos.
// kind: the line under each chapter's title (round 9: was a tracked-caps label above it)
export const STYLES = [
  { key: "realismo", name: "Realismo", kind: "Black & grey", glow: "#d3172b",
    line: "Volti, animali, divinità. Il nero costruito a strati fino al grigio più leggero, come in una fotografia.", // PLACEHOLDER
    // only his drawings from assets/da zippo (owner, round 8): owl, tiger, samurai, lotus, hand & apple
    trio: ["z13", "z09", "z04", "z15", "z19"] },
  { key: "blackwork", name: "Blackwork", kind: "Ornamentale e illustrativo", glow: "#3b7cff",
    line: "Nero pieno, geometrie, ornamenti e illustrazione. Contrasto che regge negli anni.", // PLACEHOLDER
    // his drawings: cranes and ornaments, ornamental with solid blacks, cat samurai
    trio: ["z10", "z11", "z18"] },
  { key: "fineline", name: "Fine line", kind: "Tratto sottile", glow: "#eee8e1",
    line: "Ago sottile e mano leggera: fiori, simboli, dettagli piccoli e precisi.", // PLACEHOLDER
    // his drawings: ornamental line work, ornamental skull
    trio: ["z14", "z12"] },
  { key: "lettering", name: "Lettering", kind: "Corsivo, gotico, chicano", glow: "#c8a15a",
    line: "Nomi, date, frasi. La scritta giusta per la frase giusta.", // PLACEHOLDER
    // his drawings: "Mon cher" (the lettered card), the AL3 badge from his folder (tiles only, not a design: z21)
    trio: ["z17", "z21"] },
];

export const STYLE_LABEL = { disegno: "Disegno originale", realismo: "Realismo", blackwork: "Blackwork", fineline: "Fine line", lettering: "Lettering", colore: "Colore" };

// One entry per tattoo, frames of the "Mix" reel (June 2026). id = frame number.
export const WORKS = [
  { id: "33", style: "realismo", t: "Lupo" },
  { id: "21", style: "realismo", t: "Tre volti" },
  { id: "05", style: "realismo", t: "Occhio e tempesta" },
  { id: "04", style: "realismo", t: "La sacerdotessa" },
  { id: "25", style: "realismo", t: "Figura velata" },
  { id: "37", style: "realismo", t: "Angelo" },
  { id: "28", style: "realismo", t: "Ganesha, schiena" },
  { id: "06", style: "realismo", t: "Farfalla con occhio" },
  { id: "20", style: "lettering", t: "Lettering chicano e joker" },
  { id: "14", style: "colore", t: "Spider lily rosso, “agape”" },
  { id: "09", style: "blackwork", t: "Drago sul collo" },
  { id: "26", style: "blackwork", t: "Gatto samurai" },
  { id: "16", style: "blackwork", t: "Valknut e rune" },
  { id: "07", style: "blackwork", t: "Falena" },
  { id: "36", style: "blackwork", t: "Triskele con occhio" },
  { id: "10", style: "blackwork", t: "Circuito, avambraccio" },
  { id: "11", style: "blackwork", t: "Circuito, mano" },
  { id: "08", style: "blackwork", t: "Stemma con torre" },
  { id: "42", style: "blackwork", t: "Ornamentale, in corso" },
  { id: "13", style: "fineline", t: "Rose e peonie" },
  { id: "17", style: "fineline", t: "Serpente e farfalla" },
  { id: "31", style: "fineline", t: "Loto e luna" },
  { id: "32", style: "fineline", t: "Rosa" },
  { id: "35", style: "fineline", t: "Rosa sul collo" },
  { id: "23", style: "fineline", t: "Fiori" },
  { id: "18", style: "fineline", t: "Piuma" },
  { id: "03", style: "fineline", t: "Molecole" },
  { id: "43", style: "fineline", t: "Ragno" },
  { id: "19", style: "fineline", t: "Stitch" },
  { id: "30", style: "lettering", t: "ASR · MCMXXVII" },
  { id: "44", style: "lettering", t: "Romans 8:18" },
  { id: "29", style: "lettering", t: "Cuore di Roma" },
  { id: "15", style: "lettering", t: "Nakama" },
  { id: "12", style: "lettering", t: "Nome in corsivo" },
  { id: "24", style: "lettering", t: "Leggero" },
  { id: "22", style: "lettering", t: "Tutto torna" },
  { id: "34", style: "lettering", t: "Lungo la schiena" },
  { id: "40", style: "lettering", t: "Mani e data" },
  { id: "39", style: "colore", t: "X rossa" },
  { id: "01", style: "colore", t: "Televisore" },
];

// process act: stages over scroll progress [a, b]; dot = anchor on the owl (fraction of the plate: the design on the page for 01, the arm after)
export const PROCESS = [
  { n: "01", t: "Il disegno", line: "Su misura, anche a mano libera. Prima di toccare la pelle, il lavoro esiste sulla carta.", a: 0.0, b: 0.2, dot: [0.4, 0.18] }, // PLACEHOLDER copy
  { n: "02", t: "Lo stencil", line: "La traccia viola: la mappa che l'ago seguirà, messa dove il corpo la vuole.", a: 0.2, b: 0.38, dot: [0.38, 0.4] }, // PLACEHOLDER copy
  { n: "03", t: "La linea", line: "La struttura. Una linea pulita regge tutto il resto.", a: 0.38, b: 0.58, dot: [0.33, 0.56] }, // PLACEHOLDER copy
  { n: "04", t: "L'ombra", line: "Black & grey: il nero costruito a strati, dal più profondo al grigio più leggero.", a: 0.58, b: 0.84, dot: [0.5, 0.5] }, // PLACEHOLDER copy
  { n: "05", t: "La guarigione", line: "Good habits: la cura dopo la seduta fa metà del tatuaggio.", a: 0.84, b: 1.0, dot: [0.62, 0.78] }, // PLACEHOLDER copy
];

// The Studio Space (round 8, replaces the Vipera band): his walk through the studio, scrubbed by scroll on desktop.
// stops: where the walk is (fraction of the 8.7 s film); photos: the three stills, each comes in at its moment
export const SPACE = {
  line: "Vinili e oggetti sugli scaffali, piante, neon, le postazioni: lo studio com'è, in un giro solo.", // PLACEHOLDER
  stops: [ // PLACEHOLDER labels
    { t: "La parete", at: 0 },
    { t: "Piante e neon", at: 0.23 },
    { t: "La postazione", at: 0.6 },
    { t: "La sala", at: 0.8 },
  ],
  photos: [
    { file: "parete", at: 0.02, rot: -5, drift: 60, alt: "La parete dello studio: una nicchia rossa con un quadro, scaffali di vinili e oggetti da collezione" },
    { file: "serpente", at: 0.42, rot: 4, drift: -90, alt: "Stampa incorniciata di un serpente in oro su fondo blu notte" },
    { file: "vinili", at: 0.7, rot: -2, drift: 120, alt: "Parete di vinili incorniciati e, sul banco, la stampa di una tigre" },
  ],
};

// every snake in the archive (Zippo's favourite subject): feed ids + the 2026 reel's snake & butterfly
export const SNAKES = ["a080", "a225", "a226", "a301", "a355", "a370", "a396", "a428", "a455", "a461", "a462", "a463", "a496", "a546", "a561", "a569", "a591", "a633", "17"];

export const WALKIN = {
  until: "2026-11-01", // the banner hides from this date (Rome time)
  date: "Sabato 31/10",
  hours: "dalle 14:00 alle 20:00",
  // caption verbatim from @sgt.zippo, 17 October 2026
  text: "Piercing & tatuaggi senza appuntamento con la collaborazione di @giuly_tattoo , chi prima arriva ha il posto✨",
};

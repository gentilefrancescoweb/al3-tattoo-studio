---
name: AL3 Tattoo Studio
description: Sgt. Zippo's studio in Biella: his work rising out of the dark under red and blue neon.
colors:
  red: "#d3172b"
  red-deep: "#a8101f"
  red-hi: "#ff3346"
  blue: "#3b7cff"
  gold: "#c8a15a"
  ink-950: "#0b0a0b"
  ink-900: "#121012"
  ink-800: "#1b181a"
  ink-700: "#2a2628"
  ink-600: "#3b3538"
  ink-500: "#5a5357"
  bone: "#eee8e1"
  bone-2: "#b9b1aa"
  bone-3: "#847c77"
  print-paper: "#efe9e0"
  open-green: "#3ddc84"
typography:
  display:
    fontFamily: "Cinzel, Trajan Pro, serif"
    fontSize: "clamp(38px, 6.2vw, 92px)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Cinzel, Trajan Pro, serif"
    fontSize: "clamp(28px, 3vw, 44px)"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Cinzel, Trajan Pro, serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.15
  statement:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 34px)"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0.02em"
  small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.02em"
  script:
    fontFamily: "Pinyon Script, cursive"
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 400
    lineHeight: 1.1
  hero-caps:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0.22em"
  poster:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(64px, 16vw, 230px)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.01em"
rounded:
  none: "0"
  bar: "2px"
  pill: "999px"
  circle: "50%"
spacing:
  control-gap: "8px"
  gutter: "clamp(16px, 4vw, 56px)"
  rail: "64px"
  rail-clear: "78px"
  nav: "64px"
  section: "clamp(110px, 16vh, 180px)"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.red-deep}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "{colors.ink-700}"
    textColor: "{colors.bone}"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.ink-600}"
    textColor: "{colors.bone}"
  nav-pill:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  chip:
    backgroundColor: "{colors.ink-700}"
    textColor: "{colors.bone}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "9px 14px"
  filter:
    backgroundColor: "{colors.ink-700}"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  filter-active:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  archive-tile:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
  print:
    backgroundColor: "{colors.print-paper}"
    rounded: "{rounded.none}"
    padding: "6px"
---

# Design System: AL3 Tattoo Studio

## Overview

**Creative North Star: "Ink Under Neon"**

This is a dark studio at night. The ground is warm ink, and everything worth seeing rises out of it: his drawings, his tattoos, his sculptures, each caught by the red and blue neon of the real studio. Light comes from inside the scene rather than from the interface. The mood is nocturnal.

The system is built to be seen at scroll, one act at a time. Each act holds one big thing on screen, and the page is long because the work is the show. Controls stay small, flat and quiet so that nothing competes with a tattoo. The drama belongs to the pictures and the motion, and the interface steps back.

Confirmed rejections: photo cards in the hero (designs fly free, with no arm, body or background), the red drip band under the hero, a tremor on the process plate, tape on the Art Wall, and a viper that follows the cursor.

**Key Characteristics:**
- Warm ink ground, never pure black, with bone text.
- One accent for action, Logo Red; neon blue and kintsugi gold stay in the atmosphere.
- Engraved Roman capitals for titles, a plain grotesque for everything else, and a rare script signature.
- Depth from light and real 3D, not from raised interface surfaces.
- Tattoo-world effects throughout: stencil-to-ink headings, needle light, ink splatter, the machine as cursor.

## Colors

One warm ink family, one bone family, one red for action, and two atmospheric colours taken from the studio's own neon and kintsugi.

### Primary
- **Logo Red** (#d3172b): the AL3 disc's red. Fills the WhatsApp buttons, and marks passed points on the viper rail and the progress bar. White text on it passes 4.5:1.
- **Pressed Red** (#a8101f): the hover state of Logo Red. It goes darker, never brighter, so white text stays readable.
- **Hot Neon Red** (#ff3346): small accents only: the style line under a Stili title, script lines, active stops, focus rings, the needle.

### Secondary
- **Neon Blue** (#3b7cff): the blue neon tube and its light. Atmosphere only.

### Tertiary
- **Kintsugi Gold** (#c8a15a): the gold of the VVV cracks, in the loader's crack and the crack over the sculptures. Atmosphere only.

### Neutral
- **Ink 950** (#0b0a0b): the page ground.
- **Ink 900** (#121012): the tone step for the archive and the footer.
- **Ink 800** (#1b181a): the ground under archive tiles while they load, and the viper rail's name tags.
- **Ink 700** (#2a2628): every quiet control at rest.
- **Ink 600** (#3b3538): the hover state of quiet controls.
- **Ink 500** (#5a5357): the closed-status dot.
- **Bone** (#eee8e1): titles and primary text, taken from the white of his sculptures.
- **Bone 2** (#b9b1aa): running text and nav links.
- **Bone 3** (#847c77): labels and fine print, at 13px or more.
- **Print Paper** (#efe9e0): the border of the photo prints.
- **Open Green** (#3ddc84): the open-status dot, and nothing else.

### Named Rules
**The One Action Rule.** A filled Logo Red control means WhatsApp. The single exception is the active Serpenti filter.

**The Atmosphere Rule.** Neon blue and kintsugi gold are light in the room. They never colour a button, a link or a label.

**The Warm Ink Rule.** No surface is pure black. Every dark is from the warm ink family.

## Typography

**Display Font:** Cinzel (with Trajan Pro, serif)
**Body Font:** Archivo (with system-ui, sans-serif)
**Label/Mono Font:** Pinyon Script (with cursive) for the rare signature line

**Character:** Cinzel carries the engraved Roman capitals of his VIRESCIT plaque, and Archivo stays plain and legible beside it. Pinyon Script is the hand-signed note that appears only a few times.

### Hierarchy
- **Display** (600, clamp(38px, 6.2vw, 92px), 0.98): act titles, always uppercase. Each act sizes this to its own column, from 58px to 101px at 1440px wide.
- **Headline** (600, clamp(28px, 3vw, 44px), 1): the process steps, in mixed case, where Cinzel's lowercase reads as small capitals.
- **Title** (600, 21px, 1.15): captions on prints.
- **Statement** (400 italic, clamp(24px, 2.4vw, 34px), 1.3): his quote, at most 26 characters wide.
- **Body** (400, 17px, 1.55): running text in Bone 2, at most 46 characters wide.
- **UI** (600, 15px, 0.02em): buttons.
- **Small** (400, 13px, 0.02em): tags, chips, status lines and fine print. Only the hero lines, the filter counts and the date in the privacy notice go smaller.
- **Script** (400, clamp(26px, 3vw, 38px), 1.1): "La virtù cresce dalla ferita.", "Ti sei rivisto in un lavoro?" and the footer motto, in Hot Neon Red.
- **Hero Caps** (12px, uppercase): the two lines around the hero badge, 600 at 0.22em above it and 400 at 0.26em below it.
- **Poster** (900 italic, clamp(64px, 16vw, 230px), 0.9): the event type, after his glitch posters.

### Named Rules
**The Two-Line Title Rule.** An act title holds at most two lines at every width. Keep the words, and fit the size to the column.

**The Hero Caps Rule.** Small spaced capitals belong to the first screen and nowhere else. Every other label is sentence case.

**The Signature Rule.** Pinyon Script is a signature, not a voice: one short line in a section, and rarely.

## Layout

The page is a sequence of full-screen acts. Each pinned act is a sticky stage inside a section one screen tall plus its scroll length, and heights use svh, never dvh. Text sections sit in a centred column of 1320px at most.

The left edge belongs to the viper rail: 64px wide on desktop, 22px on phones. Pictures and copy start at least 78px in (28px on phones), and the right edge mirrors that clearance. The fixed nav is 64px tall (58px on phones) and is always clear of act content.

Each act has its own composition, with copy and picture never overlapping. A picture starts past the end of its title's column, or passes behind a solid panel.

Breakpoints: below 1100px the nav links go and the archive drops from five columns to four; below 760px the layout becomes the phone composition, with two archive columns and the Studio Space unpinned; below 420px the brand text goes. On phones and coarse pointers, grain, nav blur, heavy filters and the badge's colour split are removed to keep scrolling smooth.

## Elevation & Depth

Lit, not lifted. Depth comes from neon on a dark ground and from real 3D, such as the flying designs, the floating badge layers and the owl's warped mesh. The interface itself is flat at rest: buttons, chips, tiles and panels carry no shadow, and surfaces separate by a step in ink tone.

### Shadow Vocabulary
- **Floating sheet** (`box-shadow: 0 40px 80px -30px rgba(0, 0, 0, .9)`): his drawings in Stili, which hang in the air.
- **Print** (`box-shadow: 0 30px 60px -20px rgba(0, 0, 0, .9)`): the photos landing in The Studio Space.
- **Neon spill** (`box-shadow: 0 30px 70px -25px rgba(0, 0, 0, .9), -30px 0 80px -20px rgba(211, 23, 43, .45)`): the sculpture photos, with blue on the opposite side.
- **Neon tube** (`box-shadow: 0 0 8px 2px var(--red-hi), 0 0 40px 10px rgba(211, 23, 43, .65), 0 0 160px 60px rgba(211, 23, 43, .25)`): the hero's two tubes, the same way in blue.
- **Dialog** (`box-shadow: 0 40px 100px rgba(0, 0, 0, .8)`): the privacy notice.

### Named Rules
**The Lit-Not-Lifted Rule.** A shadow belongs to an object that truly floats, and a glow belongs to something that is truly a light. Controls get neither at rest.

## Shapes

Three forms do all the work. Controls are full pills (999px), and small marks and dots are circles. Everything that shows work is square-cornered: photos, tiles, sheets and prints. The designs themselves are die-cut, so their silhouette is the shape. Bars are 2px-rounded and at least 3px tall. Thin lines are rare and each has a job: the owl's leader lines, the hero's red separator, hover underlines, and the outlines of the Studio Space window and the privacy notice.

## Components

Quiet tools, loud work: controls are flat, solid and simple, so the tattoos stay the event.

### Buttons
- **Shape:** full pill (999px), 48px tall.
- **Primary:** Logo Red with white text, for WhatsApp only.
- **Hover / Focus:** Primary goes to Pressed Red, Ghost to Ink 600, over .25s. Focus is a 2px Hot Neon Red ring, offset 3px.
- **Ghost:** a filled Ink 700 pill with Bone text, for secondary actions. Despite the name, it is never an outline.
- **Pulse:** a white dot breathes on one WhatsApp button at a time.

### Chips
- **Style:** Ink 700 pills with sentence-case text, for the event chip and the archive filters.
- **State:** the active filter inverts to Bone with Ink 950 text. The Serpenti filter is the red one: Hot Neon Red text on Ink 700, Logo Red when active.

### Cards / Containers
There are no cards. Work is held by three forms:
- **Archive tile:** 4:5 and square-cornered on Ink 800, slightly muted at rest. On hover it takes full colour, scales to 1.05, and a needle of light sweeps it as the caption rises.
- **Print:** a photo with a Print Paper border (6px, 4px on phones), tilted by a few degrees, like the studio's own prints.
- **Sheet:** his drawing on white, at its own 764:1080 proportion.

### Navigation
- **Bar:** fixed, transparent over the hero, then a blurred Ink 950 at 72% from the desk onward (solid, without blur, on phones). No line beneath it.
- **Links:** 15px sentence case in Bone 2, going to Bone with a 2px Logo Red underline that draws from the left.
- **Order:** badge and name, links, sound toggle, event chip, WhatsApp pill, menu button. Links leave below 1100px and the menu button takes over. The event chip leaves below 480px, where the menu lists it.
- **Menu:** a full-screen sheet on Ink 950 under the same red and blue light as the Art Wall. Section names in the display face, then the WhatsApp button, a call button, the live status and the address. A link closes it and lands at once, with no flight through the acts.

### Hero Badge
The studio's mark as the title, inked in by the needle, then alive. Two layers float 44px apart; the badge turns toward the pointer, light follows it, and a spark runs round the rim. Holding it runs the machine, with shudder, a red/blue split and ink spitting off the rim. A double click flips it to Sgt. Zippo's rose, built on the same geometry with the same effects, and the line above it changes with it.

### Flying Designs
Die-cut designs drift past the camera with a neon aura, red on the left and blue on the right. Clicking one opens it in the lightbox, which browses designs only.

### Viper Rail
A drawn viper down the left edge whose head marks the scroll position. Its section dots turn Logo Red once passed; on desktop each names its section on hover and scrolls there.

### Machine Cursor
On fine pointers the cursor is a coil tattoo machine with the needle tip on the pointer, leaving ink splatter on click.

### Stencil Headings
Act titles enter as purple stencil outlines and ink in letter by letter, with a brief red bloom that fades to plain Bone.

### Lightbox
A near-black veil with a light blur. Designs sit on a soft red bloom; tattoos can switch to "Sulla pelle".

## Do's and Don'ts

### Do:
- **Do** keep the ground warm ink (#0b0a0b) and let the work provide the colour.
- **Do** size each act title to its column so it holds two lines.
- **Do** start pictures past the end of the title, or pass them behind a solid panel.
- **Do** use filled tone steps for quiet controls: Ink 700 at rest, Ink 600 on hover.
- **Do** keep shadows on floating objects and glows on real lights.
- **Do** darken Logo Red on hover, to Pressed Red (#a8101f).
- **Do** give every new effect a reduced-motion version that stays calm but alive.
- **Do** use the owner's files for the AL3 badge and the rose, cut out and never redrawn.

### Don't:
- **Don't** use photo cards in the hero: designs fly with no arm, body or background.
- **Don't** put a picture under a title or statement.
- **Don't** add small spaced capitals outside the hero.
- **Don't** use neon blue or gold on a button, link or label.
- **Don't** use outlined controls or thin dividing lines between sections.
- **Don't** put shadows on buttons, chips or tiles at rest.
- **Don't** use pure black (#000) for a surface.
- **Don't** set new text below 13px.
- **Don't** add a blood band under the hero, a tremor on the process plate, tape on the wall, or a viper that follows the cursor.
- **Don't** add numbering such as 01 / 05 to steps or sections.

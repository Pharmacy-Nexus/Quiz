# Pharmacy Nexus — Luxury UI Redesign Patch

This package is a visual-only redesign for the existing Pharmacy Nexus project.

## Files included

- `index.html` — the original main index with only two additions:
  - `assets/css/pn-luxury-redesign.css`
  - `assets/js/pn-luxury-redesign.js`
- `assets/css/pn-luxury-redesign.css` — the complete presentation override.
- `assets/js/pn-luxury-redesign.js` — safe DOM decoration, visual motion, page intros, and micro-interactions.
- `assets/images/*.svg` — original pharmacy-themed vector artwork used by the redesign.

## Installation

1. Back up the current repository.
2. Copy the `assets` folder from this patch into the repository's existing `assets` folder.
3. Replace the public main `index.html` with the included `index.html`.
4. Keep all current data folders and JavaScript core files exactly as they are.
5. Deploy normally.

## Safety boundary

The patch does not modify:

- `assets/js/app.js`
- admin HTML, admin JavaScript, or admin config
- question JSON files
- subject/topic indexes
- scoring, localStorage, exam logic, navigation logic, saved questions, or profile logic

The redesign works as a CSS/visual JavaScript layer loaded after the current app files.

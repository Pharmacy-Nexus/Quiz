# Pharmacy Nexus - Ready Upload Version

This package keeps the original visual design intact and makes the site easier to upload to GitHub Pages.

## Files
- `index.html` — main site file
- `assets/js/app.js` — site interactions and local persistence
- `.nojekyll` — helps GitHub Pages serve the site cleanly

## What changed
- Design was preserved.
- JavaScript was moved into a separate file.
- Basic local persistence was added for:
  - last opened page
  - saved question state
  - personal notes count
- Search in Saved Questions now filters the saved cards.

## Upload to GitHub Pages
1. Create a new public repository on GitHub.
2. Upload all files in this folder.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main** and **/(root)**.
6. Save.

Your site link will be:
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

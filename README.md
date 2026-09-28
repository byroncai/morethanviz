# MORETHANVIZ — static website

The website is ready for GitHub Pages with index.html at this project root. There is no framework or dependency installation step.

## Publish on GitHub Pages

Upload this folder's contents (the folder containing this README and index.html) to the root of your GitHub repository. Include index.html, styles.css, app.js, gallery.json, .nojekyll, fonts/, and the complete images/ folder.

In the repository Settings → Pages, select Deploy from a branch, choose your publishing branch and / (root), then save. The site supports both a custom domain and a GitHub project URL such as https://username.github.io/repository/ through relative asset paths. No Node server is needed on the host.

## Edit

- index.html: markup, text and navigation.
- styles.css: styling and responsive rules; later overrides are intentional.
- app.js: gallery, camera, transitions and interactions.
- images/HQ/ and images/LQ/: full JPEG collections.
- images/previews/HQ/ and images/previews/LQ/: smaller grid JPEGs with matching filenames.
- fonts/: bundled wordmark font and license.
- gallery.json: generated static image list; commit this file.

LQ images reveal color on hover/focus but do not enlarge or open the fullscreen viewer. HQ retains enlargement and fullscreen viewing.

## Image changes

After adding, deleting or renaming images, run npm run build and commit the updated gallery.json along with the images. The build reads the existing images/ folder directly; it does not duplicate or delete photographs. The current manifest is already generated, so the checked-in site can be hosted immediately.

## Local preview

Run npm start, then open http://localhost:4173. If that port is occupied, use PowerShell: $env:PORT=4174; npm start

The local server detects image folder changes every two seconds. Refresh the page after code edits. Static hosting uses gallery.json instead of the local API. Do not open index.html through file://.

Run npm run check to validate JavaScript syntax. Node.js 20 or newer is recommended for local tooling.

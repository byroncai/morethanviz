# Claude Code project guide

## Project
MORETHANVIZ architectural visualization portfolio. Continue editing this existing website; do not replace it with a new framework or scaffold unless requested. Read README.md for commands and image handling.

## Source map
- index.html: actual source markup and supplied copy.
- styles.css: actual source CSS; layered overrides at the end are intentional current behavior.
- app.js: actual source vanilla JavaScript.
- images/HQ/ and images/LQ/: the two gallery collections (HQ = morethanviz.studio homepage gallery, LQ = its /lowq page), exact filenames used as titles. Full images are the site's 2500px maximum; PNG sources were saved as quality-90 JPEG.
- images/previews/HQ/ and images/previews/LQ/: 720px-wide quality-80 JPEG grid previews with the same filenames. Add one for every new image; a missing preview falls back to the full image in the grid.
- fonts/: bundled Archivo Black (SIL OFL, OFL.txt), the wordmark fallback where Arial Black is not installed.
- server.mjs and build.mjs: Node built-ins only; no installed dependencies required.
- gallery.json: generated static image manifest (npm run build); commit it alongside images/ and the root index.html.

Use npm start for preview, npm run check for syntax, npm run build for static distribution. If 4173 is occupied, set PORT to another port. Do not interrupt unrelated running servers. Never silently substitute demo imagery or remove the user's source images.

## Preserve current behavior unless the user requests changes
- One full-window pannable, equal-width masonry gallery, including center, About and Team text tiles.
- Foreground typography: regular Arial, 14px. Transparent text blocks. Separate large morethanviz wordmark: installed Arial Black (Windows, macOS) at -0.065em; elsewhere bundled Archivo Black at -0.05em via .wordmark-fallback.
- Center copy: Architecture, mediated. / Drag to explore the collection. Bottom-left: morethanviz.
- Image names match complete filenames exactly. Gallery dimensions and pan bounds adapt to image count and aspect ratios.
- HQ/LQ switch below the navigation (top right on mobile) chooses the collection; HQ by default. Each page load shuffles the images once; the order holds through refreshes and collection switches.
- Images and text start hidden, wait for image decode, fade together over 900ms, pause 250ms, then slide into place over 3.2 seconds. The settled title band stays clear at the initial camera position. Input can shorten settling. Reduced motion is respected.
- Title-band spacing measures visible glyph edges to match image gutters. The wordmark retains subtle parallax and is clamped to remain fully within the viewport at all zoom/pan extremes.
- Foreground wordmark uses difference blending; dragging crossfades it behind the images.
- Smooth drag and cursor-driven pan, bounded to content. Zoom 70–120%. Cursor pan weakens as zoom increases. After two idle seconds, camera slowly returns to center.
- Images are grayscale until hover/focus, then become color. Only HQ scales and opens the fullscreen viewer; LQ tiles are focusable non-button elements. The full-screen viewer shows original color and animates from/to the clicked tile. Grid tiles load previews; only the viewer loads full images, prefetched after a 150ms hover, on focus, and for the viewer's neighbours.
- Circular inverting cursor for mouse input.
- Team disclosures: Contact, Alvin Huang, Byron Cai. Immediate expansion, one-second mouse-exit delay before collapse. Re-enter cancels collapse. Expansion pushes following items down in the same column. Keyboard/touch controls remain usable.

## Performance and implementation notes
paint() moves the shared image-plane once per frame. Avoid reintroducing per-tile camera transforms or the old enormous paper background. The viewport-sized canvas-paper counteracts the camera transform for blending. Text and images share camera depth; title layers have their own clamped transform. Opening motion uses temporary per-tile translate and cleans up afterward.
layout() batches sizing and geometry updates and returns early until the first collection renders; scheduleLayout() coalesces image loads, Team ResizeObserver events and the wordmark font load. suppressClick only swallows the click that ends a drag; any new press or Enter/Space clears it. Keep image hover scale on the child image. Both wordmark copies must remain aligned. Maintain viewer focus handling and reduced-motion behavior.

## Verification
Run syntax checks after edits. For interaction changes, inspect desktop and mobile layouts, opening sequence, drag/cursor pan, both zoom limits, title visibility at camera extremes, Team expansion/retraction, and image viewer open/close. Do not claim frame-rate or browser results without measuring them. No automated browser test framework is currently installed.


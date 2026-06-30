#!/usr/bin/env python3
"""
Build a single self-contained HTML file (reading-buddy-artifact.html) from the
split app, so it can run as an Artifact inside the Claude app.

Inlines styles.css + data.js + app.js into one file. Drops the PWA bits
(manifest, service worker, home-screen icon) — those need separate files and a
secure origin, which an artifact sandbox doesn't provide.

Run:  python3 build-artifact.py
"""

from pathlib import Path

here = Path(__file__).parent
css = (here / "styles.css").read_text()
data_js = (here / "data.js").read_text()
app_js = (here / "app.js").read_text()

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Reading Buddy</title>
  <style>
{css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
{data_js}
  </script>
  <script>
{app_js}
  </script>
</body>
</html>
"""

out = here / "reading-buddy-artifact.html"
out.write_text(html)
print(f"Wrote {out} ({len(html):,} bytes)")

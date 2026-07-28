---
'@crawl/mobile': patch
---

Fix the Explore map camera never recentering when the selected city changes (#166): it now animates to the selected city's center and frames its coverage radius (Sayville and Charlotte no longer render at the same zoom), instead of statically framing whichever venue happened to sort first.

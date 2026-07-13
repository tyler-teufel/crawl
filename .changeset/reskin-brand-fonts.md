---
'@crawl/mobile': minor
---

Add the Crawl v2 brand typography (Clash Grotesk display + Satoshi body) and logo
SVG suite. Fonts load via expo-font, gated behind expo-splash-screen so there's no
flash of the system font; exposed as NativeWind font-display / font-sans classes.
(Captures the assets landed in #95, which shipped without a changeset.)

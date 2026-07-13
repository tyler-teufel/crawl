---
'@crawl/mobile': minor
---

Add a branded animated splash (R5): a full-screen `AnimatedSplash` overlay renders
the Crawl martini-pin mark + wordmark via SvgXml and runs a Reanimated fade-in +
scale-settle entrance, hold, then fade-out (~950ms). It mounts over the navigator
in `_layout.tsx` the moment the native splash hides, so the cold-launch handoff has
no visible gap, then unmounts once its exit animation completes.

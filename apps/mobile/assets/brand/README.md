# Crawl Brand Assets (SVG)

Vector versions of the Crawl logo system, recreated from the v2 Figma design board.

The **wordmark** files are true outlines of the brand display font (**Clash Grotesk Bold /
SemiBold / Medium**, from `../fonts/`), so they render identically everywhere without the font
installed. The **icon marks** are hand-authored geometry (location pin + martini glass) using the
brand purple gradient (`#a855f7` → `#7f13ec`).

| File | What it is |
| --- | --- |
| `crawl-lockup-horizontal.svg` | Primary lockup — white `crawl` wordmark + purple outline pin |
| `crawl-wordmark-bold.svg` | `crawl` wordmark, Clash Grotesk Bold, outlined (white) |
| `crawl-wordmark-semibold.svg` | `crawl` wordmark, Clash Grotesk SemiBold, outlined (white) |
| `crawl-wordmark-medium.svg` | `crawl` wordmark, Clash Grotesk Medium, outlined (white) |
| `crawl-icon-purple.svg` | Standalone mark — filled purple pin + white martini |
| `crawl-icon-outline.svg` | Monochrome outline pin + martini (white; recolor via `stroke`) |
| `crawl-icon-outline-purple.svg` | Purple outline pin + martini |
| `crawl-appicon.svg` | App icon — purple gradient rounded square + white pin/martini |
| `crawl-monogram.svg` | `C` monogram with purple pin-point triangle |

## Notes

- Wordmark fills are solid white (`fill="#ffffff"`); recolor by changing the `fill` on the root
  `<svg>` or the inner `<g>`.
- Icon gradients use a `<linearGradient id="g">`. If you inline several of these on one page,
  rename the `id` per file to avoid collisions.
- `viewBox` is set on every file, so they scale cleanly at any size.

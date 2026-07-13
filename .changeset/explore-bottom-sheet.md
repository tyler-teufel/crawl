---
'@crawl/mobile': minor
---

Add a drag-to-collapse bottom sheet to the Explore screen: the venue list now lives
in a sheet layered over a full-height map, dragging between a collapsed peek (map
dominates) and an expanded scrollable list. Built on RN `PanResponder` + `Animated`
(no native gesture library), so it stays OTA-deliverable. Also compacts the `VenueCard`
hero when a venue has no photo, removing the empty-block dead space.

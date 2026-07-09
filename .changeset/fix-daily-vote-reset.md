---
"@crawl/mobile": patch
---

Fix daily vote count resetting on refetch: mock vote state is now persisted in AsyncStorage keyed by date + city, so votes survive refetches, navigation, and backgrounding, and roll over cleanly at the day boundary.

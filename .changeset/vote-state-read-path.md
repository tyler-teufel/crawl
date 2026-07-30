---
'@crawl/mobile': patch
---

Read the daily vote state from the server on the Supabase path. `useVoteState` branched on `hasApi` alone, so a Supabase-only build wrote votes to Postgres but read them back from AsyncStorage — a reinstall appeared to grant a fresh daily budget while the server still held the user's votes.

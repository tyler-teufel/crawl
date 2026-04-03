# Roadmap

Prioritized next steps for Crawl, organized by release milestone.

---

## v1.1 — Core Polish (Immediate)

| Priority | Task | Description | Effort |
|----------|------|-------------|--------|
| High | Test suite | Set up Jest + React Native Testing Library. Cover context logic, hooks, and key component rendering. | 1 day |
| High | Maps integration | Replace `MapPlaceholder` with `react-native-maps`. See [Maps Integration Guide](./MAPS_INTEGRATION.md). | 2 days |
| High | Auth screens | Login, register, and onboarding flow. JWT token storage with `expo-secure-store`. | 2 days |
| Medium | City selector | Implement dropdown/modal picker for the `CitySelector` component with a list of supported cities. | 0.5 day |
| Medium | Venue images | Replace image placeholders with real venue photos. Add image caching. | 1 day |
| Medium | Global Rankings | Build the Global Rankings tab screen with mock data — city leaderboard, all-time top venues. | 1 day |
| Medium | Profile screen | User avatar, voting history, stats (total votes, streaks), and settings. | 1 day |
| Low | Haptic feedback | Trigger haptics on vote cast, tab switch, and button press using `expo-haptics`. | 0.5 day |
| Low | Pull-to-refresh | Add pull-to-refresh on the voting screen venue list (prep for backend integration). | 0.5 day |

---

## v1.2 — Backend & Infrastructure (Short Term)

| Task | Description | Effort |
|------|-------------|--------|
| EAS Build + CI | Set up `eas.json`, GitHub Actions workflows for CI validation and preview builds. See [CI/CD Pipeline](./CICD_PIPELINE.md). | 1 day |
| TanStack Query + API client | Install React Query, create API client layer, build query/mutation hooks. See [Data Pipeline Guide](./DATA_PIPELINE.md). | 2 days |
| Backend API | Build Node/Express or similar API with venues, votes, auth, and trending endpoints. PostgreSQL + Redis. | 3-5 days |
| Push notifications | Trending alerts when a venue's score crosses a threshold. Use `expo-notifications`. | 1 day |
| Venue bookmarking | Save/unsave venues, bookmarks list accessible from Profile tab. | 1 day |
| Accessibility | Add `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all interactive components. Screen reader testing. | 1 day |

---

## v2.0 — Social & Engagement (Medium Term)

| Task | Description | Effort |
|------|-------------|--------|
| Real-time vote updates | WebSocket connection for live score changes. Animate score transitions in real-time. | 2 days |
| Social features | Friend system, group crawls, share itineraries. | 5 days |
| Venue check-in | GPS-verified check-in at venues. Earn badges and streaks. | 2 days |
| Review & rating system | User reviews, star ratings, and review feed on venue detail. | 3 days |
| Bar crawl route planning | Multi-venue route builder with estimated walking times between stops. | 3 days |
| Admin dashboard | Venue owner portal for updating hours, photos, highlights, and viewing analytics. | 5 days |

---

## Future Considerations

- **Multi-city expansion** — onboard new cities with venue import from Google Places / Yelp API
- **Monetization** — featured venue placements, premium user features (unlimited votes, early access)
- **Analytics** — Mixpanel or Amplitude integration for user behavior tracking
- **Localization** — i18n support for non-English markets
- **Offline support** — cache venue data for offline browsing with automatic sync on reconnect

# CI/CD Pipeline for Mobile

Build, test, and release pipeline using EAS Build, EAS Update, and GitHub Actions.

---

## Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                        │
│                                                                  │
│   Local Dev ──► git push ──► Pull Request ──► Code Review        │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      CI PIPELINE (GitHub Actions)                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 1: Validate (runs on every push/PR)              │     │
│  │                                                         │     │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐  │     │
│  │  │ Install  │─►│  Lint    │─►│TypeCheck  │─►│  Test  │  │     │
│  │  │   deps   │  │(eslint + │  │(tsc       │  │(jest / │  │     │
│  │  │(npm ci)  │  │prettier) │  │--noEmit)  │  │ e2e)   │  │     │
│  │  └──────────┘  └──────────┘  └───────────┘  └────────┘  │     │
│  │                                                         │     │
│  │  ✗ Any failure ──► block merge                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                    merge to main                                 │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 2: Build (runs on merge to main)                 │     │
│  │                                                         │     │
│  │  ┌──────────────────────────────────────────────────┐   │     │
│  │  │              EAS Build (Expo)                    │   │     │
│  │  │                                                  │   │     │
│  │  │  ┌─────────────────┐  ┌────────────────────┐     │   │     │
│  │  │  │  iOS Build      │  │  Android Build     │     │   │     │
│  │  │  │  Profile:       │  │  Profile:          │     │   │     │
│  │  │  │  "preview"      │  │  "preview"         │     │   │     │
│  │  │  │  (internal      │  │  (APK for          │     │   │     │
│  │  │  │  distribution)  │  │  internal testing) │     │   │     │
│  │  │  └─────────────────┘  └────────────────────┘     │   │     │
│  │  └──────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                    builds complete                               │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 3: Distribute (automatic after build)            │     │
│  │                                                         │     │
│  │  ┌─────────────────┐  ┌───────────────────────────┐     │     │
│  │  │  Internal Test  │  │  QA Team Notification     │     │     │
│  │  │                 │  │                           │     │     │
│  │  │  iOS: TestFlight│  │  Slack webhook with       │     │     │
│  │  │  (internal)     │  │  build link + changelog   │     │     │
│  │  │                 │  │                           │     │     │
│  │  │  Android:       │  │  Auto-generated from      │     │     │
│  │  │  Firebase App   │  │  commit messages since    │     │     │
│  │  │  Distribution   │  │  last build               │     │     │
│  │  └─────────────────┘  └───────────────────────────┘     │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
           │
     manual approval / git tag
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    RELEASE PIPELINE                              │
│              (triggered by git tag: v1.x.x)                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 4: Production Build                              │     │
│  │                                                         │     │
│  │  EAS Build with profile: "production"                   │     │
│  │                                                         │     │
│  │  iOS: .ipa (signed with distribution cert)              │     │
│  │  Android: .aab (signed with upload key)                 │     │
│  │                                                         │     │
│  │  ┌─────────────────────────────────────────────────┐    │     │
│  │  │  OTA Check: Can this be an OTA update?          │    │     │
│  │  │                                                 │    │     │
│  │  │  YES (JS-only changes) ──► EAS Update           │    │     │
│  │  │    expo-updates pushes JS bundle                │    │     │
│  │  │    No app store review needed                   │    │     │
│  │  │    Users get update on next launch              │    │     │
│  │  │                                                 │    │     │
│  │  │  NO (native changes) ──► Full binary submit     │    │     │
│  │  │    New native modules, SDK upgrade, etc.        │    │     │
│  │  └─────────────────────────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│  ┌───────────────────────▼─────────────────────────────────┐     │
│  │  STAGE 5: Store Submission                              │     │
│  │                                                         │     │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │     │
│  │  │  EAS Submit (iOS)   │  │  EAS Submit (Android)    │  │     │
│  │  │                     │  │                          │  │     │
│  │  │  eas submit -p ios  │  │  eas submit -p android   │  │     │
│  │  │                     │  │                          │  │     │
│  │  │  ──► App Store      │  │  ──► Google Play Console │  │     │
│  │  │  Connect            │  │  (internal/beta/prod     │  │     │
│  │  │  (TestFlight ──►    │  │   track)                 │  │     │
│  │  │   App Review ──►    │  │                          │  │     │
│  │  │   Release)          │  │                          │  │     │
│  │  └─────────────────────┘  └──────────────────────────┘  │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  STAGE 6: Post-Release                                  │     │
│  │                                                         │     │
│  │  • Sentry / Bugsnag error monitoring enabled            │     │
│  │  • Analytics events verified (Mixpanel / Amplitude)     │     │
│  │  • GitHub Release created with changelog                │     │
│  │  • Rollback plan: previous EAS Update channel           │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Tools

| Tool               | Purpose                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EAS Build**      | Expo's cloud build service. Builds iOS and Android binaries without local Xcode or Android Studio. Configure via `eas.json` with build profiles (development, preview, production). |
| **EAS Submit**     | Automates store submission. Uploads `.ipa` to App Store Connect and `.aab` to Google Play Console.                                                                                  |
| **EAS Update**     | Over-the-air JavaScript bundle updates. Bypasses app store review for JS-only changes. Users receive the update on next app launch.                                                 |
| **GitHub Actions** | CI runner. Triggers on push/PR for validation, on merge to main for preview builds, on git tag for production releases.                                                             |

---

## Recommended `eas.json`

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

### Build Profiles Explained

| Profile       | When              | Output                | Distribution                     |
| ------------- | ----------------- | --------------------- | -------------------------------- |
| `development` | Daily development | Dev client app        | Internal (TestFlight / Firebase) |
| `preview`     | PR merge to main  | Production-like build | Internal (QA team testing)       |
| `production`  | Git tag `v1.x.x`  | Store-ready binary    | App Store / Google Play          |

---

## GitHub Actions Workflow

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      # Uncomment when test suite is configured:
      # - run: npm test

  build-preview:
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform all --profile preview --non-interactive
```

### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build-and-submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform all --profile production --non-interactive
      - run: eas submit --platform all --non-interactive
```

---

## OTA Updates vs Binary Releases

| Change Type                 | Deploy Method        | Review Required               | User Gets It    |
| --------------------------- | -------------------- | ----------------------------- | --------------- |
| JS code, styles, images     | `eas update` (OTA)   | No                            | Next app launch |
| New native module           | `eas build` + submit | Yes (App Store / Google Play) | Store update    |
| Expo SDK upgrade            | `eas build` + submit | Yes                           | Store update    |
| Config changes (`app.json`) | `eas build` + submit | Yes                           | Store update    |

### OTA Update Command

```bash
# Push a JS update to all users on the preview channel
eas update --branch preview --message "Fix voting countdown display"

# Push to production channel
eas update --branch production --message "Hotfix: score animation timing"
```

---

## Secrets Required

| Secret                     | Where                                      | Purpose                        |
| -------------------------- | ------------------------------------------ | ------------------------------ |
| `EXPO_TOKEN`               | GitHub Actions secrets                     | Authenticates `eas` CLI        |
| Apple ID + ASC App ID      | `eas.json` (submit config)                 | App Store Connect submission   |
| Google service account key | `google-service-account.json` (gitignored) | Google Play Console submission |

---

## Monitoring & Rollback

### Error Monitoring

Install Sentry or Bugsnag for production crash reporting:

```bash
npx expo install @sentry/react-native
```

Configure in `app/_layout.tsx` to capture unhandled errors and navigation events.

### Rollback

If a bad OTA update is pushed:

```bash
# Roll back to the previous update on a channel
eas update:rollback --branch production
```

For binary releases, submit a new build with the fix. iOS App Review typically takes 24-48 hours; Android review is usually same-day.

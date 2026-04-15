# CI/CD Pipeline for Mobile

Build, test, and release pipeline using EAS Build, EAS Update, and GitHub Actions.

---

## Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                        │
│                                                                  │
│   Local Dev ──► git push ──► Pull Request ──► Code Review        │
│                              (PR template)    (CODEOWNERS)       │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                CI PIPELINE (GitHub Actions: ci.yml)               │
│                Trigger: pull_request → main                      │
│                Concurrency: cancels stale runs per PR            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  JOB: validate                                          │     │
│  │                                                         │     │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │     │
│  │  │ Install  │─►│  Lint    │─►│TypeCheck  │─►│ Expo   │ │     │
│  │  │   deps   │  │(eslint + │  │(tsc       │  │Doctor  │ │     │
│  │  │(npm ci)  │  │prettier) │  │--noEmit)  │  │        │ │     │
│  │  └──────────┘  └──────────┘  └───────────┘  └────────┘ │     │
│  │                                                         │     │
│  │  ✗ Any failure ──► block merge                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  JOB: fingerprint (parallel with validate)              │     │
│  │                                                         │     │
│  │  Generates @expo/fingerprint hash to detect native      │     │
│  │  dependency changes (OTA eligibility check)             │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
           │
     merge to main
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│          PREVIEW BUILD (GitHub Actions: preview-build.yml)       │
│          Trigger: push → main                                    │
│          Concurrency: one build at a time                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              EAS Build (Expo)                            │    │
│  │                                                         │    │
│  │  ┌─────────────────┐  ┌────────────────────┐            │    │
│  │  │  iOS Build      │  │  Android Build     │            │    │
│  │  │  Profile:       │  │  Profile:          │            │    │
│  │  │  "preview"      │  │  "preview"         │            │    │
│  │  │  (internal      │  │  (APK for          │            │    │
│  │  │  distribution)  │  │  internal testing) │            │    │
│  │  └─────────────────┘  └────────────────────┘            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Future: Slack notification with build link                      │
└──────────────────────────────────────────────────────────────────┘
           │
     git tag v1.x.x
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│              RELEASE PIPELINE (GitHub Actions: release.yml)      │
│              Trigger: push tag v*                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  JOB 1: build                                           │     │
│  │                                                         │     │
│  │  EAS Build with profile: "production"                   │     │
│  │  iOS: .ipa (signed with distribution cert)              │     │
│  │  Android: .aab (signed with upload key)                 │     │
│  └────────────────────────┬────────────────────────────────┘     │
│                           │                                      │
│                  ┌────────▼────────┐                              │
│                  │ APPROVAL GATE   │                              │
│                  │ (GitHub         │                              │
│                  │  Environment:   │                              │
│                  │  "production")  │                              │
│                  └────────┬────────┘                              │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐     │
│  │  JOB 2: submit                                          │     │
│  │                                                         │     │
│  │  eas submit --platform all --non-interactive            │     │
│  │  iOS ──► App Store Connect                              │     │
│  │  Android ──► Google Play Console                        │     │
│  └────────────────────────┬────────────────────────────────┘     │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐     │
│  │  JOB 3: github-release                                  │     │
│  │                                                         │     │
│  │  Auto-generates changelog from commits since last tag   │     │
│  │  Creates GitHub Release with release notes              │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│            OTA UPDATE (GitHub Actions: ota-update.yml)           │
│            Trigger: manual (workflow_dispatch)                    │
│                                                                  │
│  Inputs: branch (preview|production), message                    │
│  Production branch requires "production" environment approval    │
│                                                                  │
│  eas update --branch <branch> --message "<message>"              │
│  JS-only changes pushed over-the-air, no store review needed     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Workflow Files

| File                                    | Trigger               | Purpose                                                     |
| --------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `.github/workflows/ci.yml`              | `pull_request → main` | Lint, typecheck, expo-doctor, fingerprint                   |
| `.github/workflows/preview-build.yml`   | `push → main`         | EAS preview build (iOS + Android)                           |
| `.github/workflows/ota-update.yml`      | Manual dispatch       | OTA JS bundle update via EAS Update                         |
| `.github/workflows/release.yml`         | `push tag v*`         | Production build → approval → store submit → GitHub Release |
| `.github/workflows/dependabot-auto.yml` | Dependabot PRs        | Auto-merge minor/patch dependency updates                   |

### Supporting Files

| File                               | Purpose                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `.github/dependabot.yml`           | Weekly dependency updates, grouped by ecosystem (Expo, RN, dev)         |
| `.github/CODEOWNERS`               | Requires `@tyler-teufel` review on all PRs                              |
| `.github/pull_request_template.md` | Structured PR description (what, why, type, testing, screenshots)       |
| `eas.json`                         | EAS Build profiles (development, preview, production) and submit config |

---

## Key Tools

| Tool                  | Purpose                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EAS Build**         | Expo's cloud build service. Builds iOS and Android binaries without local Xcode or Android Studio. Configure via `eas.json` with build profiles (development, preview, production). |
| **EAS Submit**        | Automates store submission. Uploads `.ipa` to App Store Connect and `.aab` to Google Play Console.                                                                                  |
| **EAS Update**        | Over-the-air JavaScript bundle updates. Bypasses app store review for JS-only changes. Users receive the update on next app launch.                                                 |
| **GitHub Actions**    | CI runner. Triggers on PR for validation, on merge to main for preview builds, on git tag for production releases.                                                                  |
| **Dependabot**        | Automated dependency update PRs with auto-merge for minor/patch versions.                                                                                                           |
| **@expo/fingerprint** | Detects native dependency changes to determine OTA eligibility.                                                                                                                     |

---

## `eas.json` Configuration

The `eas.json` file at the project root defines three build profiles:

```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
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

## Concurrency Controls

Each workflow uses concurrency groups to prevent wasted resources:

| Workflow            | Concurrency Group | Behavior                                               |
| ------------------- | ----------------- | ------------------------------------------------------ |
| `ci.yml`            | `ci-<pr-branch>`  | Cancels stale CI runs when new commits push to same PR |
| `preview-build.yml` | `preview-build`   | Only one preview build runs at a time                  |

---

## OTA Updates vs Binary Releases

| Change Type                 | Deploy Method        | Review Required               | User Gets It    |
| --------------------------- | -------------------- | ----------------------------- | --------------- |
| JS code, styles, images     | `eas update` (OTA)   | No                            | Next app launch |
| New native module           | `eas build` + submit | Yes (App Store / Google Play) | Store update    |
| Expo SDK upgrade            | `eas build` + submit | Yes                           | Store update    |
| Config changes (`app.json`) | `eas build` + submit | Yes                           | Store update    |

### OTA Update via GitHub Actions

Trigger the OTA Update workflow manually from the GitHub Actions tab:

1. Go to Actions → "OTA Update" → "Run workflow"
2. Select branch (`preview` or `production`)
3. Enter update message
4. For production, approve in the environment gate

### OTA Update via CLI

```bash
# Push a JS update to preview channel
eas update --branch preview --message "Fix voting countdown display"

# Push to production channel
eas update --branch production --message "Hotfix: score animation timing"
```

---

## Secrets & Environments

### GitHub Actions Secrets

| Secret          | Purpose                                  |
| --------------- | ---------------------------------------- |
| `EXPO_TOKEN`    | Authenticates `eas` CLI in all workflows |
| `SLACK_WEBHOOK` | (Future) Build notification to Slack     |

### GitHub Environments

| Environment  | Used By                                                          | Requires Approval              |
| ------------ | ---------------------------------------------------------------- | ------------------------------ |
| `production` | `release.yml` (submit job), `ota-update.yml` (production branch) | Yes — manual reviewer approval |

### Other Credentials

| Credential                 | Location                                   | Purpose                        |
| -------------------------- | ------------------------------------------ | ------------------------------ |
| Apple ID + ASC App ID      | `eas.json` submit config                   | App Store Connect submission   |
| Google service account key | `google-service-account.json` (gitignored) | Google Play Console submission |

---

## Branch Protection (GitHub Settings)

Configure these rules on the `main` branch:

- **Require pull request before merging**
- **Require status check: `validate`** to pass before merge
- **Require 1 approval** (enforced via CODEOWNERS)
- **Dismiss stale approvals** when new commits are pushed
- **Require branch to be up-to-date** before merging
- **No force pushes**

---

## Dependency Management

Dependabot is configured to open weekly PRs grouped by ecosystem:

| Group              | Patterns                          | Auto-merge         |
| ------------------ | --------------------------------- | ------------------ |
| `expo`             | `expo*`, `@expo/*`                | Minor & patch only |
| `react-native`     | `react-native*`, `@react-native*` | Minor & patch only |
| `dev-dependencies` | All dev deps                      | Minor & patch only |
| `github-actions`   | All actions                       | Minor & patch only |

Major version bumps require manual review.

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

---

## Setup Checklist

Before the pipeline is fully operational:

- [ ] Add `ios.bundleIdentifier` and `android.package` to `app.json`
- [ ] Run `eas init` to link the Expo project
- [ ] Add `EXPO_TOKEN` to GitHub repo secrets
- [ ] Create `production` environment in GitHub repo settings with required reviewers
- [ ] Configure branch protection rules on `main`
- [ ] Update `eas.json` submit config with real Apple ID and ASC App ID
- [ ] Add `google-service-account.json` to `.gitignore` and store securely
- [ ] (Optional) Add `SLACK_WEBHOOK` secret and uncomment notification step

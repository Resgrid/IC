<div align='center'>

<h1>Resgrid IC</h1>
<p>Resgrid IC is a tablet and desktop optimized digital incident command board — establish command on an incident, build your ICS structure, assign and track resources, and keep everyone accountable in real time.</p>

<h4> <a href="https://resgrid.com">Resgrid</a> <span> · </span> <a href="https://github.com/Resgrid/IC/blob/develop/README.md"> Documentation </a> <span> · </span> <a href="https://github.com/Resgrid/IC/issues"> Report Bug </a> <span> · </span> <a href="https://github.com/Resgrid/IC/issues"> Request Feature </a> </h4>

</div>

# :notebook_with_decorative_cover: Table of Contents

- [About the Project](#star2-about-the-project)
- [Features](#dart-features)
- [Deployment Options](#package-deployment-options)
- [Environment Variables](#key-environment-variables)
- [Getting Started](#toolbox-getting-started)
- [Roadmap](#compass-roadmap)
- [FAQ](#grey_question-faq)
- [License](#warning-license)

## :star2: About the Project

Resgrid IC is the Incident Command application for the [Resgrid](https://resgrid.com) first responder and emergency operations platform. It gives an Incident Commander a live, server-backed command board for one or many simultaneous incidents — from a single structure fire to a multi-agency event — synchronized in real time with the Resgrid Core backend and the Resgrid Responder and Unit apps.

It is built for the way command actually works in the field: tablet-first layouts with a dedicated landscape board, offline-first operation with automatic replay when connectivity returns, and one-tap actions for the things that matter under pressure.

### :dart: Features

**Command lifecycle**
- Establish command on any active call, optionally seeded from department command definition templates
- Run multiple incident command boards at once and switch between them
- Transfer command to another user (everyone on the incident is notified), close command when the incident ends
- Command details every resource sees: estimated end time and important information (hazards, staging notes, access instructions)

**ICS structure (lanes)**
- Free-form lanes — Divisions, Groups, Branches, Sectors, Strike Teams, Task Forces, Staging, Unified Command
- Per-lane identification colors that carry through to map markers
- Optional primary and secondary lane leads: a Resgrid user or an external contact with name/phone/email
- Lanes can be tied to tactical objectives (primary/secondary) and to incident needs
- Lane requirements: min/max units, riding personnel counts, and time-in-role rotation windows — advisory warnings or hard enforcement per lane
- Tap-to-move resources between lanes, with conflict prompts and early-rotation warnings

**Resources**
- Assign department units and personnel, mutual-aid resources, and ad-hoc (external/volunteer) units and personnel
- Work-time indicators and rotation-due warnings per assignment
- Resgrid users and units receive notifications (push/email/SMS per their preferences) when assigned, moved between lanes, or released

**Objectives and needs**
- Tactical objectives and benchmarks with type (general/benchmark/safety), progress tracking (0-100%), and completion
- Command-level needs (resources, logistics, medical, equipment, staffing) tracked to fulfillment with quantities and status

**Accountability and safety**
- Personnel accountability (PAR) computed from check-in timers, with green/warning/critical states
- Scene, benchmark, and custom incident timers with live countdowns
- Auto-logged, timestamped incident timeline (ICS-201 style) for every command action

**ICS roles**
- Assign NIMS/ICS functional roles (IC, Section Chiefs, Safety Officer, Division Supervisors, and more)
- Role-based incident capabilities enforced by the server

**Communications**
- On-demand tactical voice channels (PTT) with transmission logging
- Push notifications with iOS critical alerts support

**Mapping**
- Mapbox-powered incident map with unit AVL (automatic vehicle location) and live personnel positions
- Map annotations synced across devices

**Offline-first**
- Full command board operation while disconnected — every action queues locally and replays to the server on reconnect
- Delta sync keeps multiple command devices converged on the same board state

### :package: Deployment Options

#### 📱 Mobile Applications
- **Android**: APK and AAB builds for Google Play Store and direct distribution
- **iOS**: IPA builds for App Store and enterprise distribution
- Download from [GitHub Releases](https://github.com/Resgrid/IC/releases)

#### 🌐 Web Application
- Static web build that can be hosted on any web server or CDN
- Fully responsive, optimized for tablets and desktops
- See [Build Quick Reference](docs/build-quick-reference.md) for building

#### 🐳 Docker Container
- Multi-architecture Docker images (amd64, arm64)
- All configuration via environment variables at runtime
- Suitable for Kubernetes, Docker Compose, or standalone deployment
- Pull from [Docker Hub](https://hub.docker.com/r/resgridllc/ic):
  ```bash
  docker pull resgridllc/ic:latest
  docker run -p 8080:80 -e IC_BASE_API_URL="https://api.example.com" resgridllc/ic:latest
  ```
- See [Docker Deployment Guide](docker/README.md) for details

#### 🖥️ Desktop Applications (Electron)
- **Windows**: Portable exe and NSIS installer
- **macOS**: DMG and ZIP (Universal: x64 + arm64)
- **Linux**: AppImage, deb, and rpm packages
- Download from [GitHub Releases](https://github.com/Resgrid/IC/releases)

For detailed deployment instructions, see:
- [CI/CD Build System Documentation](docs/cicd-build-system.md)
- [Docker Deployment Guide](docker/README.md)
- [Build Quick Reference](docs/build-quick-reference.md)

### :key: Environment Variables

Configuration lives in `.env.{environment}` files at the project root (`development`, `staging`, `internal`, `production`), validated by `env.js`. The main variables:

| Variable | Purpose |
|---|---|
| `IC_BASE_API_URL` | Resgrid Core API base URL |
| `IC_API_VERSION` | API version (`v4`) |
| `IC_RESGRID_API_URL` | Resgrid platform URL |
| `IC_CHANNEL_HUB_NAME` | SignalR eventing hub name |
| `IC_REALTIME_GEO_HUB_NAME` | SignalR geolocation hub name |
| `IC_APP_KEY` | Application key |
| `IC_MAPBOX_PUBKEY` | Mapbox public key for mapping |
| `IC_LOGGING_KEY` | Logging key |
| `IC_COUNTLY_APP_KEY` / `IC_COUNTLY_SERVER_URL` | Analytics (optional) |
| `IC_SENTRY_DSN` | Error reporting (optional) |

## :toolbox: Getting Started

Resgrid IC is a React Native app built with Expo (SDK 54, prebuild), TypeScript, Expo Router, Zustand, and NativeWind. Package manager is yarn (v1).

### :gear: Installation

Clone the project

```bash
git clone https://github.com/Resgrid/IC.git
cd IC
```

Install dependencies

```bash
yarn install
```

### :running: Run Locally

Start the Metro dev server

```bash
yarn start
```

Run on a platform

```bash
yarn ios        # iOS device/simulator
yarn android    # Android device/emulator
yarn web        # Web browser
yarn electron:dev  # Desktop (Electron)
```

Native builds require a `google-services.json` (Android) at the project root.

### :test_tube: Quality Checks

```bash
yarn check-all  # ESLint + TypeScript + translation lint
yarn test       # Jest test suite
```

### :hammer: Building

```bash
yarn build:production:ios      # EAS build — iOS
yarn build:production:android  # EAS build — Android
yarn web:build                 # Static web export
yarn electron:build            # Desktop builds (mac/win/linux variants available)
```

## :compass: Roadmap

* [x] Server-backed multi-incident command boards
* [x] Offline-first operation with sync replay
* [x] Objectives, needs, and lane leads
* [x] Tactical voice (PTT) channels
* [ ] Map-side resource drag onto lanes
* [ ] Exportable PDF incident summary
* [ ] Vertical / high-rise incident mode

## :grey_question: FAQ

- **Can I deploy the IC App to Google Play or the Apple App Store?**
- You can, but you cannot include "Resgrid" in the name of your application or the store listing.
- **What do I need to change to deploy the IC App to the stores?**
- Search for all occurrences of `com.resgrid.command` and replace it with your app id, and replace the icons, logos, and splash screen images with your own.

## :warning: License

Distributed under the no License. See LICENSE.txt for more information.

# 🛡️ Vanguard - Advanced WebRTC Exam Proctoring & Streaming Platform

Vanguard is a state-of-the-art, room-based real-time examination proctoring and video streaming platform. Engineered with a premium glassmorphic interface, it combines high-performance WebRTC SFU streaming via **Mediasoup**, secure signaling through **Socket.io**, and persistent SQLite data layers managed by **Sequelize**.

---

## ✨ Features & Capabilities

### 🎥 Mediasoup SFU WebRTC Streaming
*   **Multi-Core Scalability:** Streams are piped across round-robin distributed CPU-bound SFU worker routers seamlessly using WebRTC.
*   **Low Latency feeds:** Instant audio and video channel publishing with low packet overhead.
*   **Strict Security Sandbox:** Standard candidates can only preview their own media feeds. They are strictly sandboxed and can never access, listen to, or view feeds of other exam takers.

### 🛡️ Real-Time Proctor Controls
*   **Remote Media Overrides:** Proctor admins can remotely pause video feeds, mute microphones, or resume candidate streams directly from their proctor grids.
*   **Student Eviction (Kicking):** Instantly evict candidates violating exam integrity policies with custom reason alerts.
*   **Sequential Audit Logging:** Every login, room entry, exit, media override, or eviction is automatically registered as a tamper-proof database log.
*   **DB-Level Account Blocking:** Administrators can write permanent block records to Sequelize database records, immediately invalidating access.

### 💬 Dual-Channel Persistent Chat (Public Room & Proctor DM)
*   **Announcements & Direct Lines:** Candidates can swap seamlessly between a **Public Room Chat** (announcements for all room members) and **Proctor DM** (a private secure line).
*   **Secure API Scoping:** Standard candidates are blocked from querying other candidate direct messages. History endpoints are cryptographically scoped via JWT token validations.
*   **Auto Hydration & Multi-Tab Sync:** Historical logs are fetched dynamically on tab selection. Direct messages sync instantly across all active connections under the same account.

### 🎹 Premium Built-In Web Audio Synthesis
*   **Dynamic Sound Presets:** pure browser Web Audio API oscillator synthesis requires **zero external assets** (fully offline-safe).
    *   `click`: Tactile sine click for button navigations.
    *   `success`: Harmonious ascending chime for successful logins or room entries.
    *   `error`: Grating sawtooth/square wave buzzer for capacity block alerts or invalid passcodes.
    *   `message`: Quiet water bubble pop sound effect on incoming messages.
    *   `join` / `leave`: Major arpeggio sweeps when users connect or disconnect.
    *   `kick`: Siren warn tone alert when candidate gets evicted.
    *   `toggle`: Dual-tone blip when feeds are remotely paused or muted.

### 👥 Configurable Capacity Enforcement
*   **Ceiling Limits:** Administrators can configure exact capacity ceilings (1-100 candidates) during room creation.
*   **Room Joining Gatekeeper:** Socket protocols reject candidates with a warning and sound triggers once room thresholds are met.

---

## 🛠️ Technology Stack

*   **Frontend:** Pure HTML5, Premium Vanilla CSS (Harmonious glassmorphic theme,Outfit typography, custom animations), Vanilla Javascript Orchestrator.
*   **Backend:** Node.js, Express.js.
*   **Signaling & Sockets:** Socket.io.
*   **Media server:** Mediasoup (Selective Forwarding Unit).
*   **Database:** Sequelize ORM (MySQL ready with a lightweight local SQLite3 fallback).

---

## 📁 System Directory Layout

```
c:\examinationProctoringSystem
├── public/                 # Premium Glassmorphic Single Page App (SPA)
│   ├── index.html          # Interactive Login, Monitor Grid, and Candidate Panel
│   ├── css/style.css       # Sleek space variables, vibrant alerts, and hover animations
│   └── js/app.js           # Client Socket.io, Lobby fetch, and Mediasoup Producer/Consumer loops
├── src/
│   ├── config/
│   │   ├── db.config.js        # Dynamic Sequelize database loader (MySQL / SQLite fallback)
│   │   └── mediasoup.config.js # CPU worker pools, port settings, and VP8/Opus codecs
│   ├── models/
│   │   ├── index.js            # Models association context manager
│   │   ├── message.model.js    # ChatMessage Sequelize schema (UUID, sender, receiver, roomId, type)
│   │   ├── room.model.js       # Proctoring Room definition with maxParticipants capacity limits
│   │   ├── user.model.js       # Candidate accounts, role types, and active room ID
│   │   └── log.model.js        # Audit trail for remote proctor overrides
│   ├── services/
│   │   ├── auth.service.js      # JWT authentication tokens and bcrypt hashing
│   │   ├── user.service.js      # Candidate lookups and status setters
│   │   ├── mediasoup.service.js # Core SFU Engine (dynamic pipeToRouter, WebRtcTransports)
│   │   └── socket.service.js    # Signaling gateway, Room capacity checks, and persistent chat routers
│   ├── middlewares/
│   │   └── auth.middleware.js   # JWT verification and role validation guards
│   ├── controllers/
│   │   ├── auth.controller.js   # Sign-up and Sign-in endpoints
│   │   ├── chat.controller.js   # Chat history query engine (Public Room vs. Secure direct DM)
│   │   ├── room.controller.js   # Room CRUD endpoints (Creation, deletion, fetching)
│   │   └── admin.controller.js  # Logging and database blocking actions
│   ├── routes/
│   │   ├── auth.routes.js       # Auth endpoint maps
│   │   ├── chat.routes.js       # Chat endpoints router
│   │   ├── room.routes.js       # Room CRUD endpoints
│   │   └── admin.routes.js      # Admin dashboard logs mapping
│   └── index.js                 # Unified entrypoint (Express + Sockets + DB sync)
```

---

## 🚀 Installation & Local Launch

### Prerequisites
Make sure you have **Node.js** installed on your system. Note that compiling Mediasoup requires compilation dependencies on Windows (C++ Build Tools / Python).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/johnwendycn/Real-Time-Exam-Video-Monitoring-System--v1.git
cd Real-Time-Exam-Video-Monitoring-System--v1
npm install
```

### 2. Configure Environment `.env`
Create a `.env` file in the root directory:
```env
PORT=3000
JWT_SECRET=supersecretvanguardkey123
DB_DIALECT=sqlite
```

### 3. Run the Server
For development:
```bash
npm run dev
```
For production:
```bash
npm start
```
The server will boot, synchronize the SQLite tables instantly, spin up CPU worker routers, and listen on: **`http://localhost:3000`**.

---

## 🧪 Functional Verification Guide

### Pre-Seeded Accounts
All accounts share the same secure password: **`Password123`**

| Username | Role | Email | Purpose |
| :--- | :--- | :--- | :--- |
| **`johnwendy`** | `admin` | `admin@vanguard.com` | Proctor / Admin dashboard access |
| **`lamins`** | `user` | `lamin@vanguard.com` | Candidate 1 |
| **`alex`** | `user` | `alex@vanguard.com` | Candidate 2 |

### Walkthrough Verification Steps
1. **Access the Lobby:** Open three browser windows/different tabs to `http://localhost:3000/`.
2. **Log In as Admin:**
   * Tab 1: Log in as `johnwendy`.
   * Click **"Create Exam Room"** in the top right.
   * Enter Room Name: `Algebra Final`, Passcode: `999`, and **Max Candidates Capacity**: `2`. Click Create.
3. **Log In as Candidate A:**
   * Tab 2: Log in as `lamins`.
   * Select `Algebra Final` from the selector. Enter passcode `999` and click "Join Examination".
   * Click **"Initiate Broadcast"** and allow camera/microphone permissions.
   * Send a message to the Public Room Chat: *"Hi class!"*. Switch to Proctor DM and type: *"Can you hear me?"*.
4. **Log In as Candidate B:**
   * Tab 3: Log in as `alex`.
   * Select `Algebra Final` and join.
   * Go to **Public Chat**. Observe Candidate A's message: *"Hi class!"* renders instantly.
   * Go to **Proctor DM**. Observe that Candidate B's DM space is empty and fully isolated from Candidate A's messages.
5. **Enforce Capacity Ceilings:**
   * Open a 4th tab and register/log in a third student (e.g. Candidate C).
   * Attempt to join `Algebra Final`.
   * The entry is blocked instantly. The client triggers a red Toast warning and plays the synthesiser sawtooth buzzer error.
6. **Proctor Live View & Real-Time Swaps:**
   * Go to Tab 1 (Admin) and click **"Monitor Session"** on the room card.
   * Video boxes for both active candidates appear inside the grid.
   * Click the Chat icon on `lamins`'s video box to open the chat dashboard.
   * Switch between **Direct DM** and **Public Room Chat** tabs. Reply to them and observe real-time persistence and alerts!

# 🎓 Study Flow Organizer v4.2

[![Version](https://img.shields.io/badge/Version-4.2.0-blue.svg)](https://github.com/sinasharifi-7462/Study_Flow_Organizer)
[![Architecture: Modular ES Modules](https://img.shields.io/badge/Architecture-Modular%20ES%20Modules-success.svg)](#)
[![Zero NPM Runtime Dependencies](https://img.shields.io/badge/Dependencies-Zero%20NPM%20Modules-brightgreen.svg)](#)
[![Dual Calendar: Gregorian & Jalali](https://img.shields.io/badge/Calendar-Gregorian%20%2B%20Shamsi-orange.svg)](#)
[![AI Assistant: Local & Cloud](https://img.shields.io/badge/AI-Ollama%20%7C%20Gemini%20%7C%20DeepSeek-purple.svg)](#)
[![Windows Explorer Integration](https://img.shields.io/badge/Windows-Native%20Folder%20Bridge-0078D4.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An intelligent, privacy-first, 100% offline-capable academic workspace, deadline planner, and course materials hub. Built for university students, researchers, and self-directed learners who want total control over their academic life with direct local disk persistence, native Windows File Explorer integration, and an ambient voice-enabled AI schedule assistant.

---

## 🌟 What's New in v4.2

* **🤖 Ambient AI Schedule Assistant & Voice Push-to-Talk**: Speak or type natural language instructions in **English** or **Persian (فارسی)** to automatically schedule homework, labs, quizzes, and exams. Connects to offline local models via **Ollama** or cloud providers (**Gemini**, **DeepSeek**, **OpenAI**) with a visual preview of changes before they are applied.
* **📋 Interactive Kanban Board View**: Track tasks across stages (**To Do**, **In Progress**, **Done**, and **Overdue**) with interactive status toggles and urgency badges.
* **📅 Dual Calendar System (Gregorian & Jalali / Shamsi)**: Native astronomical date converter and custom Jalali date/time pickers without external libraries.
* **🖥️ Silent Standalone Desktop Launcher**: Launch without distracting black terminal windows via `Launch_Study_Flow.vbs` or the native desktop launcher.
* **💾 Standard OS Persistence & Automated Safety Backups**: Two-way disk sync with `%APPDATA%\StudyFlowOrganizer\` (or portable `data/`), creating timestamped safety snapshots before every write operation.

---

## 🚀 Key Features

### 1. 🗂️ Clean Course Hub & Modular Architecture
* **Zero Dummy Bloat**: Ships with a clean starter state—ready for your own courses, course codes, and gradient color themes.
* **Modular ES Modules**: Clean separation of concerns across CSS and JavaScript modules—no monolithic single-file code.
* **Instant Frictionless Access**: Zero fake client-side logins or password walls.

### 2. 📑 4 High-Density Productivity Views
* **Cards Grid View**: Course cards with progress indicators, upcoming deadline badges, and expandable task/event drawers.
* **Courses & Schedule Matrix (Table View)**: High-density schedule matrix with inline subject editing, countdown chips, and expandable course accordions.
* **Proportional Timeline View**: Milestones where vertical spacing scales proportionally to actual elapsed time between deadlines.
* **Kanban Board**: Visual workflow board with columns for *To Do*, *In Progress*, *Done*, and *Overdue* with quick action transitions.

### 3. 🤖 AI Schedule Assistant & Push-to-Talk Voice
* **Push-to-Talk**: Hold `Spacebar` (when outside text inputs) or press `Alt + A` to dictate schedules and deadlines hands-free.
* **Bilingual Natural Language Parsing**: Understands instructions such as *"Schedule Fluid Mechanics quiz next Monday at 10 AM"* or *"پروژه ارتعاشات رو برای شنبه ساعت ۱۲ بذار"*.
* **Multiple AI Engines**: Run 100% offline with local models via **Ollama** (`llama3`, `mistral`, `deepseek-r1`, `qwen`), or use **Google Gemini**, **DeepSeek**, or **OpenAI**.
* **Safety Preview Cards**: View and edit proposed changes before applying them to your local database.

### 4. 📅 Dual Gregorian & Jalali (Shamsi) Calendar
* **Simultaneous Date Display**: Header and dates display both Gregorian and Solar Hijri (Shamsi) dates simultaneously.
* **Custom Jalali Pickers**: Built-in Jalali date/time picker with native Persian month and leap-year calculations.

### 5. 📁 Safe Windows File Explorer Integration
* **One-Click Folder Opening**: Click any linked course folder chip to open it directly in **Windows File Explorer** via safe backend child process spawning.
* **Native Windows Folder Picker**: Select course folders directly through a native Windows folder browser dialog without manual copy-pasting or brittle custom URL protocols.

### 6. 💾 Genuine Disk Persistence & Safety Snapshots
* **Direct Disk Link**: Connects directly to local storage via a lightweight zero-dependency local Node.js server.
* **Automatic Safety Snapshots**: Every write to disk automatically creates a timestamped safety backup in the `backups/` directory.
* **Redundant Browser Fallback**: If launched without Node.js, transparently operates in standalone browser mode with `localStorage`.

### 7. 🎨 Custom Theme Engine & Modern Glassmorphism
* **Flat vs. Glassmorphism**: Toggle between crisp flat cards and frosted glass surfaces with backdrop blur.
* **6 Accent Palettes**: Choose from Teal, Blue, Purple, Amber, Emerald, and Rose themes.

---

## 📂 Project Structure

```text
Study_Flow_Organizer/
│
├── Launch_Study_Flow.vbs             # ⚡ Silent Windows launcher (zero terminal windows)
├── Launch_Study_Flow.bat             # ⚡ Resilient batch launcher with automatic fallbacks
├── Push_To_GitHub.bat                # 🚀 Interactive terminal dashboard to push updates
├── Pull_From_GitHub.bat              # 🔄 Safe pull dashboard with data preservation
├── Study_Flow_Organizer.ico          # 🎨 Application desktop icon
├── package.json                      # Project metadata & convenience scripts
├── README.md                         # Documentation and architecture guide
├── LICENSE                           # MIT License
├── .gitignore                        # Safeguards backups, builds & user files
│
├── desktop/                          # Native Desktop Container
│   └── launcher.js                   # Frameless desktop window launcher (Edge/Chrome app mode)
│
├── server/                           # Local API & Static Server (Zero npm dependencies)
│   └── server.js                     # REST API: persistence, explorer launcher, git sync, AI proxy
│
├── app/                              # Modular Client Application
│   ├── index.html                    # Semantic HTML5 shell (~680 lines)
│   ├── favicon.ico                   # Web favicon
│   ├── icon.png                      # App icon image
│   ├── icon.svg                      # Scalable vector icon
│   │
│   ├── css/                          # Modular CSS Stylesheets
│   │   ├── variables.css             # Color tokens, accent themes & glassmorphism variables
│   │   ├── base.css                  # CSS reset, typography, utility classes, buttons
│   │   ├── components.css            # Header, toolbar, search, filter pills, stats, toasts
│   │   ├── views.css                 # Cards grid, table matrix, timeline & kanban styles
│   │   ├── modals.css                # Modal dialog overlays, AI modal & form styles
│   │   └── custom-controls.css       # Custom date/time pickers & dropdown controls
│   │
│   └── js/                           # Native ES Modules
│       ├── app.js                    # Application bootstrap, routing & keyboard shortcuts
│       ├── state.js                  # Central reactive state store & data normalization
│       ├── api.js                    # REST API client with offline localStorage fallback
│       ├── dateUtils.js              # Gregorian ISO-8601 formatting, countdowns & urgency engine
│       ├── jalali.js                 # Solar Hijri (Shamsi) astronomical conversion & formatting
│       ├── markdown.js               # Lightweight markdown parser & interactive checklist renderer
│       │
│       ├── components/               # Custom UI Components
│       │   ├── customDatePicker.js   # Dual Gregorian/Jalali date picker
│       │   ├── customTimePicker.js   # 24-hour time selector
│       │   ├── customSelect.js       # Accessible styled dropdowns
│       │   └── editableCourseSelect.js # Inline course selector with live color badges
│       │
│       ├── services/                 # External Integrations & AI
│       │   ├── aiService.js          # Ollama, Gemini, DeepSeek, OpenAI provider client
│       │   └── quickAiVoice.js       # Push-and-hold voice capture & speech recognition
│       │
│       ├── views/                    # Dynamic View Renderers
│       │   ├── cardsView.js          # Course cards grid & expandable task drawer
│       │   ├── tableView.js          # High-density schedule matrix
│       │   ├── timelineView.js       # Chronological proportional timeline
│       │   └── kanbanView.js         # Interactive 4-column kanban board
│       │
│       └── modals/                   # Dialog Controllers
│           ├── itemModal.js          # Task & Event create/edit dialog
│           ├── subjectModal.js       # Course subject create/edit dialog
│           ├── folderModal.js        # Native Windows folder linking dialog
│           ├── backupModal.js        # Settings, theme, backups & storage management
│           └── aiModal.js            # AI schedule assistant modal & preview diff cards
│
├── data/                             # Academic Database & Backups
│   ├── study_flow_data.json          # Active repository database (clean starter state)
│   ├── study_flow_data.template.json # Template for fresh initializations
│   └── backups/                      # Automatic timestamped safety backups
│
├── scripts/                          # Maintenance, Build & CLI Tools
│   ├── build_standalone_exe.js       # Bundles application into standalone executable
│   ├── build_c_launcher.bat          # Automated script to compile native C launcher with icon
│   ├── launcher.c                    # Pure C Windows GUI launcher source
│   ├── generate_icon.py              # Icon generation utility
│   ├── Deregister_Legacy_Protocol.bat# Removes deprecated openfile:// registry key
│   ├── Register_System_File_Launcher.bat # Notice pointing to secure local server
│   ├── sync_github.ps1               # Dynamic Git push engine
│   └── pull_github.ps1               # Safe Git pull engine
│
└── src-tauri/                        # Optional Tauri Desktop Scaffolding
    ├── Cargo.toml                    # Rust dependencies
    ├── tauri.conf.json               # Tauri window and permissions config
    └── src/main.rs                   # Tauri application entry point
```

---

## 🚀 Quick Start Guide

### Step 1: Clone the Repository
```bash
git clone https://github.com/sinasharifi-7462/Study_Flow_Organizer.git
cd Study_Flow_Organizer
```

### Step 2: Launch Study Flow Organizer

You have several convenient ways to launch:

#### Option A: Silent Windows Launcher (Recommended)
Double-click **`Launch_Study_Flow.vbs`**.
* Launches the application as a standalone desktop window without any command prompt window flashing.

#### Option B: Resilient Batch Launcher
Double-click **`Launch_Study_Flow.bat`**.
* Automatically detects your environment:
  1. Launches native standalone executable if built.
  2. Or launches via Node.js desktop mode (`http://127.0.0.1:3456`).
  3. Or falls back to Standalone Browser Mode using `localStorage`.

#### Option C: Node.js Command Line
```bash
npm start
```
* Starts the local server and opens a dedicated application window in Microsoft Edge or Google Chrome.

#### Option D: Standalone Browser Mode (No Node.js Required)
Simply double-click **`app/index.html`** in your file manager to use the application entirely inside your browser using `localStorage`.

---

## 🔨 Building Standalone Executable (.exe)

Study Flow Organizer provides multiple options to build native `.exe` binaries for Windows:

### Method 1: Self-Contained Standalone Executable (Recommended)
Bundles the entire application, local server, and a portable Node.js runtime into a single, standalone executable that runs on any Windows machine without requiring Node.js to be installed.

```bash
npm run build:exe
```
* **How it works**: Uses `scripts/build_standalone_exe.js` and `caxa` to bundle all runtime assets, then automatically patches the Windows PE header from Subsystem 3 (Console) to Subsystem 2 (Windows GUI).
* **Zero Terminal Flashing**: Launches cleanly as a native desktop application with no black terminal window.
* **Output**: `dist/Study_Flow_Organizer.exe` (~35 MB). You can copy this single file to any Windows computer and run it directly.

---

### Method 2: Ultra-Lightweight Native C Launcher (~50 KB)
If you prefer a tiny, native Windows launcher that uses your existing system Node.js and Edge/Chrome browser:

* **Using Batch Script**: Double-click **`scripts/build_c_launcher.bat`**
* **Or via npm / GCC command**:
  ```bash
  npm run build:launcher
  ```
  *(Requires MinGW-w64 GCC and `windres` installed on your machine)*
* **How it works**: Compiles `scripts/launcher.c` and `scripts/app.rc` into a pure Win32 GUI executable with the application icon embedded. Silently checks port `3456`, spawns the server with `CREATE_NO_WINDOW`, and opens Edge/Chrome in dedicated app mode.
* **Output**: `Study_Flow_Organizer.exe` in the repository root.

---

### Method 3: Native Desktop Build with Tauri (Rust + WebView2)
For an ultra-compact native desktop binary and Windows installer (.msi):

```bash
# 1. Install Tauri CLI (if not already installed)
cargo install tauri-cli

# 2. Build production release
npm run build:tauri
# or
cargo tauri build
```
* **How it works**: Uses Tauri 1.5 to compile a native Rust application window backed by Microsoft Edge WebView2.
* **Output**: `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| `Space` (Hold) | Global (outside text fields) | **Push-and-Hold AI Voice**: speak your deadline command |
| `Alt + A` | Global | Open AI Schedule Assistant dialog |
| `Ctrl + N` | Global | Open **New Task / Event** creation modal |
| `Ctrl + Shift + V` | Global | Cycle between **Cards**, **Matrix Table**, **Timeline**, and **Kanban** views |
| `/` or `Ctrl + F` | Global | Focus the global search bar |
| `Escape` | Global | Close any active modal dialog or dropdown |

---

## 🤖 Configuring the AI Assistant

Study Flow Organizer supports both local offline models and cloud AI providers:

### 1. Local Offline AI with Ollama (100% Private & Free)
1. Install [Ollama](https://ollama.ai/).
2. Pull your model of choice:
   ```bash
   ollama run mistral
   # or
   ollama run llama3
   # or
   ollama run deepseek-r1:8b
   ```
3. Open Study Flow Organizer, click the **Settings & Storage** icon (⚙️), and select **Ollama (Local)**.
4. Set the endpoint (defaults to `http://127.0.0.1:11434`) and choose your downloaded model from the dropdown.

### 2. Cloud AI Providers (Gemini, DeepSeek, OpenAI)
1. In the **Settings & Storage** modal, select your preferred provider (**Google Gemini**, **DeepSeek**, or **OpenAI**).
2. Enter your API key. Keys are saved securely in your browser's local storage and are never transmitted to any third party.
3. Select your desired model.

---

## 🔒 Privacy, Security & Data Sovereignty

* **100% Data Sovereignty**: Your academic schedule and notes live on your physical computer (`%APPDATA%\StudyFlowOrganizer\study_flow_data.json` on Windows, or `data/` in portable mode).
* **Zero Remote Telemetry**: No tracking cookies, no Google Analytics, no third-party CDNs.
* **Safe OS Execution**: File Explorer integration uses safe local server child processes with path validation rather than insecure custom URI protocol handlers.
* **Automatic Safety Snapshots**: A timestamped backup is generated in `backups/` every time data is modified.

---

## 🤝 Contributing

Contributions from the community are warmly welcomed!

1. **Fork the repository** on GitHub:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Study_Flow_Organizer.git
   cd Study_Flow_Organizer
   git remote add upstream https://github.com/sinasharifi-7462/Study_Flow_Organizer.git
   ```
2. **Create a descriptive feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   * Keep modules focused and follow existing clean architecture patterns.
   * Preserve zero-dependency vanilla JS principles where possible.
4. **Commit with conventional messages**:
   ```bash
   git commit -m "feat(kanban): add tag filtering support"
   ```
5. **Push to your fork and submit a Pull Request**:
   ```bash
   git push -u origin feature/your-feature-name
   ```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute for personal, educational, and commercial purposes.

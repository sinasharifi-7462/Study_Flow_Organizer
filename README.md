# 🎓 Study Flow Organizer v4.3

[![Version](https://img.shields.io/badge/Version-4.3.0-blue.svg)](https://github.com/sinasharifi-7462/Study_Flow_Organizer)
[![Architecture: Modular ES Modules](https://img.shields.io/badge/Architecture-Modular%20ES%20Modules-success.svg)](#)
[![Zero NPM Runtime Dependencies](https://img.shields.io/badge/Dependencies-Zero%20NPM%20Modules-brightgreen.svg)](#)
[![Dual Calendar: Gregorian & Jalali](https://img.shields.io/badge/Calendar-Gregorian%20%2B%20Shamsi-orange.svg)](#)
[![AI Assistant: Local & Cloud](https://img.shields.io/badge/AI-Ollama%20%7C%20Gemini%20%7C%20DeepSeek-purple.svg)](#)
[![Test Suite: Vitest](https://img.shields.io/badge/Tests-22%20Passed%20(Vitest)-brightgreen.svg)](#)
[![Windows Explorer Integration](https://img.shields.io/badge/Windows-Native%20Folder%20Bridge-0078D4.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An intelligent, privacy-first, 100% offline-capable academic workspace, deadline planner, and course materials hub. Built for university students, researchers, and self-directed learners who want complete control over their academic schedule with direct local disk persistence, native Windows File Explorer folder bridges, ambient voice-driven AI planning, and a distraction-free keyboard-first workflow.

---

## 🌟 What's New in v4.3

* **⚡ Desktop Command Palette (`Ctrl + K` / `Cmd + K`)**: Universal spotlight overlay to instantly switch views, execute quick creation actions, toggle themes, and fuzzy-search across courses, tasks, and notes without taking your hands off the keyboard.
* **📅 Weekly Agenda Mode & Drag-and-Drop Rescheduling**: Toggle between the full 30-day monthly grid and a high-density 7-day weekly agenda column view. Reschedule assignments instantly by dragging assignment cards across day cells, complete with a 1-click **[Undo]** toast notification.
* **🎯 1-Click Segmented View Switcher & Interactive Stats Filtering**:
  * Seamless view navigation via a unified segmented control (`Cards [1]`, `Calendar [2]`, `Timeline [3]`, `Kanban [4]`).
  * Live stat counters (`Total`, `Tasks`, `Events`, `Urgent`, `Done`) function as instant 1-click filters with active indicators and dynamic pill counts.
* **📝 Natural Language Quick-Add & Smart Date Presets**:
  * Discreet inline quick-add input on Course Cards and the Kanban *To Do* column (`HW 3 tomorrow`, `Fluid Midterm on friday`, `Quiz in 3 days`).
  * Instant smart deadline buttons in task modals: `Today (23:59)`, `Tomorrow (23:59)`, `This Fri (23:59)`, `Next Mon (23:59)`, and `+7 Days`.
* **☀️ Clean Daylight Light Mode & Rigid Color System**:
  * Pure white and soft slate paper interface (`nord_light`) engineered for bright classrooms, libraries, and daytime study.
  * Mathematical WCAG 2.1 contrast calculations (`getContrastRatio`, `getHighContrastText`) guarantee optimal legibility for course cards and banners across both flat and glassmorphic styles.
* **⚙️ Minimalist 2x2 Settings & Storage Hub**: Re-engineered configuration center divided into 4 cards (*Appearance & Theme*, *AI Assistant*, *Storage & Snapshots*, and *Keyboard Shortcuts*) with smooth height morphing and zero visual jump.
* **🧪 Vitest Unit Test Suite**: Comprehensive automated test coverage (22 tests across 4 test suites) verifying date parsing, urgency calculation, state normalization, and theme color algorithms.

---

## 🚀 Key Features

### 1. 🗂️ Clean Course Hub & Modular ES Architecture
* **Zero Bloat Starter State**: Ready out-of-the-box for your courses, course codes, custom instructors, and dynamic gradient banners.
* **Zero NPM Runtime Dependencies**: The client application and local Node.js persistence server run on vanilla modern web standards and native Node.js standard libraries (`http`, `fs`, `path`, `child_process`).
* **Modular ES Modules**: Clean separation of concerns across state management, API synchronization, custom pickers, dynamic views, and modal dialogs.

### 2. 📑 4 High-Density Academic Views
* **Cards Grid View (`1`)**: Course cards with progress meters, urgency badges, inline quick task creator, and expandable task/event drawers.
* **Academic Calendar View (`2`)**:
  * **Monthly Mode**: 30-day academic grid displaying dual Gregorian and Solar Hijri (Shamsi) dates simultaneously.
  * **Weekly Agenda Mode**: 7-day vertical column schedule with hour markers and quick day-level addition.
  * **Interactive Drag & Drop**: Drag assignment chips across dates to reschedule instantly with safety undo.
* **Proportional Timeline View (`3`)**: Chronological milestone stream where vertical spacing scales proportionally to actual elapsed time between deadlines.
* **Interactive Kanban Board (`4`)**: 3-column workflow (*To Do*, *In Progress*, *Done*) with urgency badges, course filter pill bar, inline quick-add, and 1-click completion checkboxes.

### 3. 🤖 Ambient AI Assistant & Voice Push-to-Talk
* **Push-and-Hold Voice Capture**: Hold `Spacebar` (when outside text inputs) or press `Alt + A` to dictate schedules and deadlines hands-free.
* **Bilingual Natural Language Parsing**: Fluent in both **English** and **Persian (فارسی)**:
  * *"Schedule Heat Transfer homework 3 next Tuesday at 23:59"*
  * *"پروژه طراحی اجزا رو برای چهارشنبه ساعت ۵ بعدازظهر بذار"*
* **Multiple Model Providers**:
  * **100% Offline Local AI**: Connects seamlessly to [Ollama](https://ollama.ai/) (`llama3`, `mistral`, `deepseek-r1`, `qwen`).
  * **Cloud Providers**: Native support for **Google Gemini**, **DeepSeek**, and **OpenAI**.
* **Safety Diff Cards**: View and edit parsed actions with visual validation before committing them to your database.

### 4. 📅 Dual Gregorian & Jalali (Shamsi) Calendar System
* **Astronomical Precision**: Built-in solar algorithm calculating Jalali leap years and astronomical shifts without third-party dependencies.
* **Native Custom Pickers**: Tailored Gregorian and Jalali date/time picker controls with 24-hour time sliders and leap-year validation.

### 5. 📁 Safe Windows File Explorer Integration
* **One-Click Folder Opening**: Click any linked course folder chip to launch directly in **Windows File Explorer** via safe backend child-process execution.
* **Native Folder Browser Dialog**: Select course folders using Windows' native folder picker without manual path copy-pasting.

### 6. 💾 Local Disk Persistence & Safety Snapshots
* **Direct OS Persistence**: Synchronizes changes automatically with `%APPDATA%\StudyFlowOrganizer\study_flow_data.json` (or portable `data/`).
* **Automated Safety Backups**: Every write operation creates a timestamped safety snapshot in the `backups/` directory before writing to disk.
* **Resilient Browser Fallback**: Runs completely in standalone browser mode with `localStorage` if launched without Node.js.

### 7. 🎨 Rigid Color System & Palette Customizer
* **5 Master Palettes**:
  * **Teal Slate (Default)**: Deep oceanic slate with vibrant teal and powder petal accents.
  * **Clean Daylight (`nord_light`)**: Crisp paper-white interface with sky cerulean accents.
  * **Minimal Black (`black`)**: OLED true dark canvas with crisp silver surfaces.
  * **Flat Dark Blue (`dark_blue`)**: Deep navy midnight aesthetic with neon turquoise accents.
  * **Custom 5-Color (`custom`)**: User-defined 5-color palette with live contrast evaluation.
* **Glassmorphic vs. Flat Mode**: One-click toggle between backdrop frosted glass blur and solid crisp flat surfaces.

---

## 📂 Project Structure

```text
Study_Flow_Organizer/
│
├── Launch_Study_Flow.vbs             # ⚡ Silent Windows launcher (zero terminal window flashing)
├── Launch_Study_Flow.bat             # ⚡ Resilient batch launcher with automatic runtime fallbacks
├── Push_To_GitHub.bat                # 🚀 Interactive terminal dashboard to push updates
├── Pull_From_GitHub.bat              # 🔄 Safe pull dashboard with data preservation
├── Study_Flow_Organizer.ico          # 🎨 Application desktop icon
├── package.json                      # Project metadata, scripts, and Vitest configuration
├── README.md                         # Comprehensive documentation and architecture guide
├── LICENSE                           # MIT License
├── .gitignore                        # Safeguards user data, backups, and build artifacts
│
├── desktop/                          # Native Desktop Shell
│   └── launcher.js                   # Spawns headless local server and opens Edge/Chrome app window
│
├── server/                           # Local REST Persistence Server (Zero NPM dependencies)
│   └── server.js                     # REST API: disk persistence, backups, explorer spawning, AI proxy
│
├── app/                              # Frontend Client Application
│   ├── index.html                    # Semantic HTML5 shell with dynamic modal mount targets
│   ├── favicon.ico                   # Web favicon
│   ├── icon.png                      # App icon image
│   ├── icon.svg                      # Scalable vector icon
│   │
│   ├── css/                          # Modular CSS Stylesheets
│   │   ├── variables.css             # Color tokens, accent themes, typography & transitions
│   │   ├── base.css                  # CSS reset, accessibility styles, utility classes, buttons
│   │   ├── components.css            # Header, toolbar, search, segmented switcher, toasts, stats
│   │   ├── views.css                 # Cards grid, calendar (month & week), timeline & kanban
│   │   ├── modals.css                # Dialog overlays, 2x2 settings landing view & form styles
│   │   └── custom-controls.css       # Custom date/time pickers & dropdown controls
│   │
│   └── js/                           # Native ES Modules
│       ├── app.js                    # Application bootstrap, routing & global event orchestration
│       ├── state.js                  # Central reactive state store & data normalization schema
│       ├── api.js                    # REST API client with offline localStorage fallback
│       ├── dateUtils.js              # ISO-8601 formatting, urgency engine & quick task parser
│       ├── jalali.js                 # Solar Hijri (Shamsi) astronomical conversion & formatting
│       ├── markdown.js               # Lightweight markdown parser & interactive checklist engine
│       ├── theme.js                  # Rigid Color System, luminance & WCAG contrast engine
│       ├── icons.js                  # Vectorized SVG icon dictionary (zero emoji dependencies)
│       ├── toast.js                  # Non-blocking notification toasts with [Undo] actions
│       │
│       ├── components/               # Custom UI Components
│       │   ├── commandPalette.js     # Desktop Command Palette (Ctrl+K) controller
│       │   ├── customDatePicker.js   # Dual Gregorian/Jalali date picker
│       │   ├── customTimePicker.js   # 24-hour time selector
│       │   ├── customSelect.js       # Accessible styled dropdowns
│       │   └── editableCourseSelect.js # Course selector with live color badge preview
│       │
│       ├── services/                 # External Integrations & AI
│       │   ├── aiService.js          # Ollama, Gemini, DeepSeek, OpenAI client & parser
│       │   └── quickAiVoice.js       # Push-and-hold voice capture & speech recognition
│       │
│       ├── views/                    # Dynamic View Renderers
│       │   ├── cardsView.js          # Course cards grid with inline quick-add & task drawers
│       │   ├── calendarView.js       # Month grid & weekly agenda with drag-and-drop rescheduling
│       │   ├── timelineView.js       # Proportional chronological milestone stream
│       │   └── kanbanView.js         # 3-column workflow board with course filter & quick-add
│       │
│       └── modals/                   # Dynamic Modal Dialog Controllers
│           ├── modalTemplates.js     # Extracted HTML templates for on-demand modal mounting
│           ├── itemModal.js          # Task & Event dialog with smart date preset buttons
│           ├── subjectModal.js       # Course subject create/edit dialog
│           ├── folderModal.js        # Native Windows folder linking dialog
│           ├── backupModal.js        # 2x2 Settings, theme, backups & storage management
│           ├── trashModal.js         # Soft-delete trash bin & item recovery controller
│           ├── tagModal.js           # Course topic tagging dialog
│           └── aiModal.js            # AI assistant modal & interactive preview diff cards
│
├── test/                             # Automated Unit Test Suite (Vitest)
│   ├── dateUtils.test.js             # Tests for remaining time, urgency, and natural language parser
│   ├── theme.test.js                 # Tests for WCAG contrast ratios, luminance, and palette presets
│   ├── state.test.js                 # Tests for schema normalization, soft-delete, and item mutations
│   └── filtering.test.js             # Tests for view-aware filters, topic tags, and search queries
│
├── data/                             # Academic Database & Backups
│   ├── study_flow_data.json          # Active repository database (clean starter state)
│   ├── study_flow_data.template.json # Template for fresh initializations
│   └── backups/                      # Automatic timestamped safety backups
│
└── scripts/                          # Maintenance, Build & CLI Tools
    ├── build_standalone_exe.js       # Bundles application into standalone executable
    ├── build_c_launcher.bat          # Compiles lightweight native C launcher with icon
    ├── launcher.c                    # Pure Win32 C launcher source
    ├── sync_github.ps1               # Automated Git push synchronization script
    └── pull_github.ps1               # Safe Git pull synchronization script
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
* Launches the application as a standalone desktop window without distracting terminal popups.

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

## ⌨️ Keyboard Shortcuts Reference

Study Flow Organizer is built for rapid, keyboard-centric productivity:

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Global | **Open Command Palette**: Search views, courses, tasks, and execute quick actions |
| `1` | Global (outside text fields) | Switch to **Cards Grid View** |
| `2` | Global (outside text fields) | Switch to **Academic Calendar View** |
| `3` | Global (outside text fields) | Switch to **Proportional Timeline View** |
| `4` | Global (outside text fields) | Switch to **Kanban Board** |
| `Space` (Hold) | Global (outside text fields) | **Push-and-Hold AI Voice**: Dictate your deadline command |
| `Alt + A` | Global | Open AI Schedule Assistant dialog |
| `N` or `Alt + N` | Global (outside text fields) | Open **New Task / Event** creation modal |
| `/` or `Ctrl + F` | Global | Focus the global search bar |
| `Escape` | Global | Dismiss Command Palette, modals, and dropdown menus |

---

## 🧪 Automated Testing

Study Flow Organizer includes an automated unit test suite powered by [Vitest](https://vitest.dev/):

```bash
# Run the test suite
npm test

# Run tests in watch mode during development
npm run test:watch
```

### Test Coverage Highlights:
* **`test/theme.test.js`**: Validates mathematical WCAG 2.1 contrast compliance ($\ge 4.5:1$), relative luminance calculations, 5 master palette definitions, and dynamic gradient generation.
* **`test/dateUtils.test.js`**: Validates urgency classification, overdue detection, chronological sorting, and natural language quick-task parsing.
* **`test/state.test.js`**: Validates data schema migration, normalization, soft-delete trash arrays, and immutability.
* **`test/filtering.test.js`**: Validates view-aware status filters, topic tag queries, and full-text search matching.

---

## 🔨 Building Standalone Executable (.exe)

Study Flow Organizer provides multiple build pathways for native Windows binaries:

### Method 1: Self-Contained Standalone Executable (Recommended)
Bundles the entire application, local server, and a portable Node.js runtime into a single, standalone executable that runs on any Windows machine without requiring Node.js to be installed.

```bash
npm run build:exe
```
* **How it works**: Uses `scripts/build_standalone_exe.js` and `caxa` to bundle runtime assets, then automatically patches the Windows PE header from Subsystem 3 (Console) to Subsystem 2 (Windows GUI).
* **Zero Terminal Flashing**: Launches cleanly as a native desktop application with no command prompt window.
* **Output**: `dist/Study_Flow_Organizer.exe` (~35 MB).

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
3. Open Study Flow Organizer, click the **Settings** icon (⚙️) or press `Ctrl + K` $\to$ Settings, and select **AI Assistant Configuration**.
4. Set the provider to **Ollama (Local)**, verify the endpoint (`http://127.0.0.1:11434`), and select your model from the dropdown.

### 2. Cloud AI Providers (Gemini, DeepSeek, OpenAI)
1. In the **Settings** modal, navigate to **AI Assistant Configuration** and select your preferred provider (**Google Gemini**, **DeepSeek**, or **OpenAI**).
2. Enter your API key. Keys are saved securely in your browser's local storage and are never transmitted to any third party.
3. Click **Fetch Available Models** and select your desired model.

---

## 🔒 Privacy, Security & Data Sovereignty

* **100% Data Sovereignty**: Your academic schedule and notes live on your physical computer (`%APPDATA%\StudyFlowOrganizer\study_flow_data.json` on Windows, or `data/` in portable mode).
* **Zero Remote Telemetry**: No tracking cookies, no Google Analytics, and no third-party CDNs.
* **Safe OS Execution**: File Explorer integration uses safe local server child processes with path validation rather than insecure custom URI protocol handlers.
* **Automatic Safety Snapshots**: A timestamped backup is generated in `backups/` every time data is modified.

---

## 🤝 Contributing & Pull Requests

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
   * Run `npm test` to verify all unit tests pass before committing.
4. **Commit with conventional messages**:
   ```bash
   git commit -m "feat(calendar): add weekly agenda mode"
   ```
5. **Push to your fork and submit a Pull Request**:
   ```bash
   git push -u origin feature/your-feature-name
   ```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute for personal, educational, and commercial purposes.

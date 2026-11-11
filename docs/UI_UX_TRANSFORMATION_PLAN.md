# 🎨 Study Flow Organizer - UI/UX Overhaul Masterplan

## 🌟 Executive Summary
This document tracks the comprehensive modernization of Study Flow Organizer to transform it into a publication-grade, ultra-efficient academic workspace.

---

## 📋 Comprehensive Feature & Polish Checklist

### Phase 1: High-Density Layout & Navigation Velocity
- [x] **Consolidated Header & Segmented View Switcher**:
  - Replaced view dropdown with 1-click segmented pill control (`Cards Grid`, `Calendar`, `Timeline`, `Kanban`).
  - Added visual keyboard shortcuts (`1`, `2`, `3`, `4`) directly on the segmented control tabs.
- [x] **Restored Disk Sync Status Indicator**:
  - Re-added `#diskSyncBadge` and `#diskSyncText` to the app header.
  - Live status dot: green for AppData disk sync, amber for standalone localStorage.
- [x] **Interactive Stats Filter Chips**:
  - Converted static stat counters (`Total`, `Tasks`, `Events`, `Urgent`, `Done`) into interactive 1-click filters.
  - Active toggle states with dynamic badge counts in sync with filter pills.

### Phase 2: Rapid Task Entry & Scheduling Ergonomics
- [x] **1-Click Smart Date Presets in Item Modal**:
  - Added instant shortcut chips: `Today (23:59)`, `Tomorrow (23:59)`, `This Fri (23:59)`, `Next Mon (23:59)`, `+7 Days`.
  - Auto-fills date and time without requiring manual navigation through the month calendar grid.
- [x] **Inline Quick-Add on Course Cards**:
  - Discreet 1-line input at the bottom of every course card: `[ + Add task... (e.g. HW 3 tomorrow) ]`.
  - Natural language parsing (`parseQuickTaskInput`) with relative date keywords (`today`, `tomorrow`, `friday`, `+N days`) and type recognition (`quiz`, `exam`, `hw`).
- [x] **Tactile Checkbox & Completion Polish**:
  - Spring-scale bounce on checkbox toggle (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - Smooth strikethrough transition.

### Phase 3: Aesthetic Polish, Lighting & Clean Light Mode
- [x] **Official Daylight / Clean Light Mode (`nord_light`)**:
  - Pure white & soft slate paper-like interface for bright daylight study sessions and libraries.
  - Available in Settings Modal alongside Teal Slate, Minimal Black, and Flat Dark Blue.
- [x] **Tabular Numerals (`tnum` / `tabular-nums`)**:
  - Applied across all stat counters, urgency badges, timer pills, and calendar day numbers to eliminate layout jitter.

### Phase 4: Advanced View Enhancements
- [x] **Calendar Weekly Agenda Mode**:
  - 7-day responsive columns alongside the 30-day monthly grid with a 1-click mode toggle.
- [x] **Direct Drag-and-Drop Rescheduling on Calendar**:
  - Dragging any assignment chip from one day to another directly reschedules it with an instant [Undo] toast.
- [x] **Kanban Course Filter & Direct Actions**:
  - Quick course filter pill bar for the Kanban board to isolate individual subjects.
  - 1-click completion checkbox directly on Kanban cards without dragging across columns.
  - Inline quick-add input at the bottom of the "To Do" column.
- [x] **Desktop Command Palette (`Ctrl + K` / `Cmd + K`)**:
  - Global spotlight overlay for searching courses, tasks, triggering quick actions, switching views, and toggling themes.

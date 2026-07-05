# Contributing to MIT OCW Knowledge Map

Thanks for your interest in contributing! This project aims to make MIT's open curriculum navigable as an interactive knowledge graph.

## How to Contribute

### 🐛 Reporting Bugs

Open an issue with:

- Expected behavior vs actual behavior
- Steps to reproduce
- Browser + OS details
- Screenshot if applicable

### ✨ Suggesting Features

Open an issue with the `enhancement` label. Describe the feature and why it would be useful for learners exploring the MIT curriculum.

### 🔧 Pull Requests

1. **Fork the repo** and create a feature branch

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes.** No build step required — the app is vanilla HTML/JS/CSS.

3. **Test locally:**

   ```bash
   python app/build_data.py   # regenerate data.js if needed
   open app/index.html        # test in browser
   ```

4. **Commit with a clear message:**

   ```bash
   git commit -m "Add prerequisite edges for Course 6.xxx"
   ```

5. **Push and open a PR** against the `main` branch.

### 📝 Coding Guidelines

- **JavaScript:** Use the existing style — IIFE wrapper, `const`/`let`, arrow functions, template literals
- **Python:** Standard formatting, docstrings on new functions
- **HTML/CSS:** Keep it vanilla — no frameworks. Dark theme consistency.
- **Prerequisites:** When adding edges, ensure both courses exist in the dataset. GIR courses should use `"GIR"` as the prerequisite.
- **Cross-department edges:** These are valuable! If you know a course chain that spans departments (e.g., Math → Physics → EECS), add it.

### 📦 Prerequisite Data Format

```js
const PREREQUISITES = {
  18.02: ["18.01"], // Multivariable Calculus → requires Single-Variable Calc
  6.006: ["6.0001", "18.02"], // Algorithms → requires Python + Multivariable Calc
  6.867: ["6.006", "6.041", "18.06"], // ML → requires Algorithms + Probability + LinAlg
};
```

### 🎯 Priority Areas

These are areas where contributions would be especially valuable:

| Priority  | Area                                     | Why                                              |
| --------- | ---------------------------------------- | ------------------------------------------------ |
| 🔴 High   | Humanities prerequisites (21H, 21L, 21M) | Currently no edges for history/literature/music  |
| 🔴 High   | Mobile responsiveness                    | Graph works poorly on phones                     |
| 🟡 Medium | Additional learning paths                | Only 12 paths currently defined                  |
| 🟡 Medium | Prerequisite verification                | Some edges may need correction by MIT affiliates |
| 🟢 Low    | Performance optimization                 | 2,800+ nodes can be slow on low-end devices      |
| 🟢 Low    | Accessibility (a11y)                     | Screen reader support, keyboard navigation       |

### 🚫 What Not to Contribute

- Large binary assets (images, videos, fonts)
- Framework rewrites (React, Vue, etc. — the zero-build philosophy is intentional)
- MIT-trademarked content beyond what OCW already provides
- Course content (videos, PDFs) — the app links to OCW, it doesn't host content

## Development Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/mit-ocw-knowledge-map.git
cd mit-ocw-knowledge-map

# Scrape data (optional — pre-built data.js may be included)
pip install requests
python scrape_courses.py

# Build the app data
python app/build_data.py

# Start local server
python -m http.server 8000 -d app/
# Open http://localhost:8000
```

## Project Structure Overview

```
app/
├── index.html          # Entry point — loads D3.js + data.js + prerequisites.js + app.js
├── app.js              # State management, graph build/render, highlight, UI event handlers
├── data.js             # Auto-generated: COURSES array + COURSE_MAP + DEPARTMENTS + GROUPS
├── prerequisites.js    # Hand-curated: PREREQUISITES object + UNLOCKS lookup + helpers
└── build_data.py       # Python: scraped JSON → data.js with dedup + color/level/group logic
```

### Key Architecture Notes

- **data.js** is the only generated file — don't edit it directly
- **prerequisites.js** is the primary file for community contributions
- **The graph is stateless on refresh** — all state resets when the page reloads
- **"GIR"** in prerequisites means the course is a General Institute Requirement course with no formal prerequisites
- **Lone nodes** are courses with no prerequisite connections — toggle them off with the "Hide lone" switch

## Questions?

Open a [Discussion](https://github.com/YOUR_USERNAME/mit-ocw-knowledge-map/discussions) or file an issue.

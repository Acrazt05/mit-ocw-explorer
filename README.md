# 🗺️ MIT OCW Knowledge Map

**Interactive curriculum explorer** — browse MIT's 2,800+ open courses as a force-directed knowledge graph.

See prerequisites, discover learning paths, find gateway courses, and export printable study roadmaps.

<p align="center">
  <img src="https://img.shields.io/badge/courses-2%2C811-blue" alt="Courses">
  <img src="https://img.shields.io/badge/prerequisites-1%2C300%2B-green" alt="Prerequisites">
  <img src="https://img.shields.io/badge/licenses-MIT-yellow" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome">
</p>

## ✨ Features

- **Interactive force-directed graph** — 2,811 course nodes, 1,300+ prerequisite edges
- **Department filtering** — 40+ MIT departments with color-coded nodes
- **Level & feature filters** — Undergraduate/Graduate, Video lectures, Notes, Problem sets, etc.
- **12 built-in learning paths** — Robotics, AI/ML, Quantum Computing, Biotech, Economics, Physics, Pure Math, CS Theory, Control Systems, Aerospace, Data Science, Energy
- **Gateway course stars ⭐** — Automatically identifies courses that unlock the most subsequent courses
- **Prerequisite chain highlighting** — Click any course to see its full ancestor chain with gradient coloring
- **PDF export** — Print a complete, numbered roadmap with course descriptions, prerequisites, and unlocks
- **Collapsible sidebar** — Clean, minimal UI that maximizes graph real estate
- **Zoom, pan, drag, search** — Full D3.js interactivity with minimap and view controls

## 🚀 Quick Start

### Option 1: Open directly (no build required)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/mit-ocw-knowledge-map.git
cd mit-ocw-knowledge-map

# Generate course data
python app/build_data.py

# Open in browser
open app/index.html
```

### Option 2: Scrape fresh data from MIT OCW

```bash
# Install dependencies
pip install requests

# Scrape all courses from MIT OCW API (takes ~5 minutes)
python scrape_courses.py

# Or use the incremental updater (faster)
python update_data.py

# Generate the app data file
python app/build_data.py

# Open
open app/index.html
```

### Option 3: Use the web-hosted version (coming soon)

Once published, just open `app/index.html` from any web server — no Python needed if you include the pre-built `data.js`.

## 📁 Project Structure

```
mit-ocw-knowledge-map/
├── app/                    # Browser application
│   ├── index.html          # Main entry point
│   ├── app.js              # D3.js force graph logic
│   ├── data.js             # Auto-generated course data (build_data.py)
│   ├── prerequisites.js    # ~1,300 prerequisite relationships
│   └── build_data.py       # Transforms scraped JSON → data.js
├── data/                   # Raw scraped data (gitignored in large form)
│   └── all_courses.json    # Complete course dump from MIT OCW API
├── scrape_courses.py       # Full MIT OCW scraper
├── update_data.py          # Incremental data updater
├── scrape_mit.py           # Initial exploration scraper
├── search_js.py            # API search helper
├── .gitignore
├── LICENSE
└── README.md
```

## 🎮 Usage

### Graph Controls

| Action            | How                           |
| ----------------- | ----------------------------- |
| **Pan**           | Drag background               |
| **Zoom**          | Scroll wheel / Trackpad pinch |
| **Select course** | Click node                    |
| **Move node**     | Drag node                     |
| **Deselect**      | Click background              |

### Sidebar

1. **Search** — Search by course number, title, description, or topic
2. **Departments** — Toggle section to filter by department (collapsible)
3. **Filters & Options** — Level (UG/Grad), Features (Videos, Notes, etc.), Hide lone nodes, Sort
4. **Learning Path** — Select a curated path to highlight specific courses
5. **Detail Panel** — Shows selected course info, prerequisites, unlocks, full chain
6. **Export PDF** — Appears when a course is selected; opens a printable roadmap

## 🏗️ Architecture

### Data Flow

```
MIT OCW API (Elasticsearch)
    ↓ scrape_courses.py
data/all_courses.json (raw dump)
    ↓ app/build_data.py
app/data.js (processed for browser)
    ↓ app/app.js (D3.js)
Interactive Graph ← → app/prerequisites.js (edges)
```

### Prerequisite Data

The prerequisite graph is a **hand-curated dataset** in `app/prerequisites.js`. MIT OCW does not expose structured prerequisite data — these edges were built from:

- MIT course catalog requirements
- OCW course page descriptions
- Standard curriculum sequences across 21 departments

The graph contains **1,300+ prerequisite edges** covering Mathematics, Physics, EECS, Chemistry, Biology, Mechanical Engineering, Civil Engineering, Economics, Aeronautics, Materials Science, Chemical Engineering, Earth Sciences, Nuclear Engineering, Brain & Cognitive Sciences, Management, Biological Engineering, Architecture, Urban Studies, Linguistics, Health Sciences, and Political Science.

### Adding or Correcting Prerequisites

Edit `app/prerequisites.js`. Each entry maps a course number to its array of prerequisite course numbers:

```js
const PREREQUISITES = {
  18.02: ["18.01"], // Multivariable Calculus requires Single-Variable Calc
  6.006: ["6.0001", "18.02"], // Algorithms requires Python + Multivariable Calc
  5.111: ["GIR"], // "GIR" means General Institute Requirement (no prereqs)
};
```

No rebuild required — just refresh the page.

### Adding Learning Paths

Edit the `LEARNING_PATHS` object in `app/app.js`:

```js
const LEARNING_PATHS = {
  "my-path": {
    name: "🆕 My Path",
    courses: ["18.01", "18.02", "6.0001", "6.006"],
  },
};
```

## ⚙️ Python Scripts

### `scrape_courses.py`

Full scraper — fetches all MIT OCW courses via the Elasticsearch API. Searches across all department facets, then dumps to `data/all_courses.json`.

```bash
python scrape_courses.py
# Output: data/all_courses.json (~8MB, 3,784 raw courses)
```

### `update_data.py`

Incremental updater — fetches only the most recently added courses. Stops when it encounters 100 consecutive existing entries. Faster than a full scrape.

```bash
# Incremental update (fast)
python update_data.py

# Full rescan (rebuilds from scratch)
python update_data.py --full

# Skip scraping, only rebuild data.js
python update_data.py --skip-scrape
```

### `app/build_data.py`

Transforms `data/all_courses.json` into `app/data.js` — deduplicating cross-listed courses (e.g., 16.885J), computing department colors, group affiliations for layout, and course levels.

```bash
python app/build_data.py
# Output: app/data.js (~1.8MB, 2,811 unique courses)
```

## 🔧 Tech Stack

| Layer                   | Technology                                                |
| ----------------------- | --------------------------------------------------------- |
| **Graph visualization** | D3.js v7 (force simulation)                               |
| **UI**                  | Vanilla HTML/CSS/JS (zero build step)                     |
| **Fonts**               | Inter + JetBrains Mono (Google Fonts)                     |
| **Data pipeline**       | Python 3 (requests, json)                                 |
| **Data source**         | MIT OCW Elasticsearch API (`open.mit.edu/api/v0/search/`) |

## 🚢 Deploying

### Static hosting (recommended)

The app is entirely client-side. Host it on any static file server:

```bash
# GitHub Pages: push to main branch, enable Pages in repo settings
# Netlify: drag-and-drop the app/ folder
# Vercel: vercel --prod
# Any HTTP server: python -m http.server 8000 -d app/
```

### Prerequisite

The browser needs `app/data.js` to exist. Either:

1. Run `python app/build_data.py` before deploying, or
2. Include a pre-built `data.js` in your repo

## 📝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas that need help:

- More prerequisite edges for humanities/social science courses
- Mobile-responsive layout improvements
- Additional learning paths
- Prerequisite scraping from MIT course catalog pages
- Performance optimization for low-end devices

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

Course data sourced from MIT OpenCourseWare ([ocw.mit.edu](https://ocw.mit.edu)) under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

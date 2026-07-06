# Changelog

All notable changes to the MIT OCW Knowledge Map.

## [1.1.0] - 2026-07-05

### Added

- **Multi-course planning** — Shift+Click to select multiple courses simultaneously. Merged prerequisite chains show all ancestors across selections with topological sorting.
- **Taken course tracking** — Right-click any node to mark courses as ✔ completed. Green checkmarks appear on nodes and persist via localStorage.
- **Cascade marking** — When marking a course with prerequisites as taken, a dialog asks whether to also mark all prerequisites recursively.
- **Taken courses excluded from plans** — All prerequisite chains and plan exports automatically skip courses marked as taken. Plans rebuild in real-time when courses are marked/unmarked.
- **Save & load plans** — Name and save course selections to localStorage. Saved plans appear in a sidebar panel and can be loaded, deleted, or exported.
- **File export/import** — Download all saved plans as a `.json` file or load plans from a file via the ⬇ File / ⬆ File buttons.
- **Prerequisite tree graph in PDF** — Export now includes a second page with a top-to-bottom tree diagram. Course nodes are colored by department, selected courses highlighted in purple, and all nodes hyperlink to OCW search.
- **Individual course removal** — Each selected course card now has a ✕ button to remove just that course from the plan.

### Changed

- Detail panel redesigned for multi-course selection: shows individual course cards with remove buttons, merged prerequisite chain, and common unlocks
- Export bar now shows two buttons side-by-side: Export PDF and Save Plan
- Graph highlight system (`highlightAll`) merges and colors chains from all selected nodes
- Help hint updated to document all interaction modes (Scroll, Drag, Click, Shift+Click, Right-Click)
- `selectNode()` now works with an array of selected nodes (`selectedNodes`) with a getter for backward-compatible `selectedNode`

### Fixed

- Tooltip persistence bug: tooltip now hides on zoom/pan and on node selection, preventing it from appearing "stuck" after scrolling
- Tooltip dismisses on node click (previously remained if clicking a selected node)
- Cross-listed course deduplication (e.g., 16.885J no longer appears twice)
- Self-referencing prerequisite bugs (8.511, 8.701, 8.821, 8.962, 6.524, 6.641)
- Level derivation from MIT course numbering convention when API data missing
- Graph no longer jitters when marking courses as taken (checkmarks applied in-place without re-render)

## [1.0.0] - 2026-07-05

### Added

- Interactive D3.js force-directed graph with 2,811 MIT OCW courses
- 1,300+ prerequisite edges across 21 MIT departments
- Department filtering with color-coded nodes (40+ departments)
- Level filters (Undergraduate/Graduate) and Feature filters (Videos, Notes, Problem Sets, etc.)
- 12 curated learning paths: Robotics, AI/ML, Quantum Computing, Biotech, Economics, Physics, Pure Math, CS Theory, Control Systems, Aerospace, Data Science, Energy
- Gateway course detection — courses that unlock 3+ subsequent courses get a ⭐ badge
- Prerequisite chain highlighting with orange→gold→white gradient for full ancestor paths
- PDF export of learning paths with numbered course cards, descriptions, prerequisites, and unlocks
- Collapsible sidebar filters (Departments and Filters & Options sections)
- Zoom, pan, drag, search, and "fit all" controls
- Hide lone nodes toggle
- Sort options (course number, alphabetical, department)
- Course detail panel with prerequisites, unlocks, and full chain visualization
- Incremental data updater (`update_data.py`) with full rescan support
- Python data pipeline: scrape → transform → build

### Changed

- N/A (initial release)

### Fixed

- Cross-listed course deduplication (e.g., 16.885J no longer appears twice)
- Self-referencing prerequisite bugs (8.511, 8.701, 8.821, 8.962, 6.524, 6.641)
- Level derivation from MIT course numbering convention when API data missing

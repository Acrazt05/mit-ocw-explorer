# Changelog

All notable changes to the MIT OCW Knowledge Map.

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

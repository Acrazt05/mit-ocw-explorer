"""
Update MIT OCW data - fetch new courses since last scrape and rebuild.
Usage: python update_data.py
Options:
  --full    Re-scrape everything (default: incremental - only new courses)
  --skip-scrape  Only rebuild data.js from existing all_courses.json
"""
import sys
import json
import os
import time
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
COURSES_FILE = os.path.join(DATA_DIR, "all_courses.json")
APP_DIR = os.path.join(BASE_DIR, "app")

def fetch_courses(size=50, page=0):
    """Fetch a batch of courses from the OCW search API."""
    body = {
        "from": page * size,
        "size": size,
        "query": {
            "bool": {
                "filter": [{"term": {"object_type": "course"}}],
                "must": [{"match_all": {}}]
            }
        },
        "sort": [{"runs.best_start_date": {"order": "desc"}}]
    }
    try:
        r = requests.post(
            "https://open.mit.edu/api/v0/search/",
            json=body,
            headers={"Content-Type": "application/json", "User-Agent": "MIT-OCW-Updater/1.0"},
            timeout=30
        )
        if r.status_code != 200:
            print(f"  API error: {r.status_code}")
            return None
        return r.json()
    except Exception as e:
        print(f"  Request failed: {e}")
        return None

def extract_course(hit):
    """Extract course data from API hit."""
    src = hit.get("_source", {})
    runs = src.get("runs", [])
    run = runs[0] if runs else {}
    return {
        "id": src.get("id"),
        "title": src.get("title", ""),
        "description": src.get("short_description", ""),
        "coursenum": src.get("readable_id") or src.get("coursenum", ""),
        "department": src.get("department_name", []) if isinstance(src.get("department_name"), list) else [src.get("department_name", "")],
        "level": run.get("level", []),
        "topics": src.get("topics", []),
        "url": src.get("url", ""),
        "image_src": src.get("image_src", ""),
        "run_title": run.get("run_id", ""),
        "course_feature_tags": src.get("course_feature_tags", []),
        "instructors": src.get("instructors", []),
        "semester": run.get("semester", ""),
        "year": run.get("year"),
    }

def scrape_new_courses(existing_ids):
    """Scrape only courses not already in our dataset."""
    print("Fetching latest course batch from MIT OCW...")
    result = fetch_courses(1, 0)
    if not result:
        print("Failed to connect to API.")
        return []
    
    total = result.get("hits", {}).get("total", 0)
    print(f"Total courses on OCW: {total}")
    print(f"Currently have: {len(existing_ids)}")
    
    new_courses = []
    page = 0
    found_existing_streak = 0
    
    while True:
        result = fetch_courses(50, page)
        if not result:
            break
        
        hits = result.get("hits", {}).get("hits", [])
        if not hits:
            break
        
        new_in_batch = 0
        for hit in hits:
            course = extract_course(hit)
            cid = course.get("id")
            if cid and cid not in existing_ids:
                new_courses.append(course)
                existing_ids.add(cid)
                new_in_batch += 1
                print(f"  NEW: {course['coursenum']} - {course['title'][:60]}")
            else:
                found_existing_streak += 1
        
        # Stop if we've seen enough existing courses (data is sorted by date, newest first)
        if found_existing_streak > 100 and new_in_batch == 0:
            print(f"\nReached existing courses. Stopping scan.")
            break
        
        page += 1
        time.sleep(0.2)
    
    print(f"\nFound {len(new_courses)} new courses.")
    return new_courses

def main():
    full_scrape = "--full" in sys.argv
    skip_scrape = "--skip-scrape" in sys.argv
    
    # Load existing data
    existing_courses = []
    if os.path.exists(COURSES_FILE):
        with open(COURSES_FILE, "r", encoding="utf-8") as f:
            existing_courses = json.load(f)
    
    existing_ids = {c.get("id") for c in existing_courses if c.get("id")}
    print(f"Existing courses in dataset: {len(existing_courses)}")
    
    if not skip_scrape:
        if full_scrape:
            print("\n=== FULL RESCRAPE ===")
            print("This will replace all course data. Use --incremental for new only.")
            # In full mode, just re-run scrape_courses.py
            import subprocess
            subprocess.run([sys.executable, os.path.join(BASE_DIR, "scrape_courses.py")])
        else:
            print("\n=== INCREMENTAL UPDATE ===")
            new_courses = scrape_new_courses(existing_ids)
            
            if new_courses:
                # Merge
                all_courses = existing_courses + new_courses
                with open(COURSES_FILE, "w", encoding="utf-8") as f:
                    json.dump(all_courses, f, indent=2, ensure_ascii=False)
                print(f"\nSaved {len(all_courses)} total courses to {COURSES_FILE}")
            else:
                print("\nNo new courses found. Dataset is up to date.")
    
    # Rebuild data.js
    print("\n=== REBUILDING DATA.JS ===")
    import subprocess
    subprocess.run([sys.executable, os.path.join(APP_DIR, "build_data.py")])
    print("\nDone! Refresh the browser to see updated data.")

if __name__ == "__main__":
    main()
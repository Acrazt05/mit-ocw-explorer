"""
Scrape all MIT OCW courses using the official API.
Uses https://open.mit.edu/api/v0/search/ which powers the OCW search.
"""
import requests
import json
import time
import os

API_URL = "https://open.mit.edu/api/v0/search/"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def build_search_body(from_val=0, size=50, text="", department=None):
    """Build the Elasticsearch query body for the OCW search API."""
    body = {
        "from": from_val,
        "size": size,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"object_type": "course"}}
                ],
                "must": [
                    {"match_all": {}}
                ]
            }
        },
        "sort": [{"department_course_numbers.sort_coursenum": {"order": "asc"}}],
        "aggregations": {
            "department_name": {
                "terms": {"field": "department_name", "size": 100}
            }
        }
    }
    if text and text.strip():
        body["query"]["bool"]["must"] = [
            {"multi_match": {"query": text, "fields": ["title^3", "description", "coursenum^5"]}}
        ]
    if department:
        body["query"]["bool"]["filter"].append(
            {"term": {"department_name": department}}
        )
    return body

def fetch_page(from_val, size=50, department=None):
    """Fetch one page of results."""
    body = build_search_body(from_val, size, department=department)
    try:
        r = requests.post(API_URL, json=body, headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0"
        }, timeout=30)
        if r.status_code == 200:
            return r.json()
        else:
            print(f"  Error {r.status_code}: {r.text[:200]}")
            return None
    except Exception as e:
        print(f"  Request error: {e}")
        return None

def extract_course(hit):
    """Extract relevant course data from a search hit."""
    src = hit.get("_source", {})
    return {
        "id": src.get("id", ""),
        "title": src.get("title", ""),
        "description": src.get("description", "")[:300] if src.get("description") else "",
        "coursenum": src.get("coursenum", ""),
        "department": src.get("department_name", ""),
        "level": src.get("level", []),
        "topics": src.get("topics", []),
        "url": src.get("url", ""),
        "image_src": src.get("image_src", ""),
        "run_title": src.get("run_title", ""),
        "course_feature_tags": src.get("course_feature_tags", []),
        "instructors": src.get("instructors", []),
    }

def scrape_all_courses():
    """Scrape all courses from the API."""
    all_courses = []
    departments = set()
    
    # First, get the first page to see total and departments
    print("Fetching initial page...")
    result = fetch_page(0, 1)
    
    if not result:
        print("Failed to connect to API. Trying alternative endpoint...")
        return scrape_from_ocw_direct()
    
    total = result.get("hits", {}).get("total", 0)
    print(f"Total courses in OCW: {total}")
    
    # Get department list from aggregations
    aggs = result.get("aggregations", {}).get("department_name", {}).get("buckets", [])
    for bucket in aggs:
        departments.add(bucket["key"])
    
    print(f"Departments found: {len(departments)}")
    for d in sorted(departments):
        print(f"  - {d}")
    
    # Now scrape by department to handle the 10k limit
    for dept in sorted(departments):
        print(f"\nScraping department: {dept}")
        dept_courses = []
        from_val = 0
        page_size = 100
        
        while True:
            result = fetch_page(from_val, page_size, department=dept)
            if not result:
                break
            
            hits = result.get("hits", {}).get("hits", [])
            if not hits:
                break
            
            for hit in hits:
                course = extract_course(hit)
                dept_courses.append(course)
            
            print(f"  Fetched {from_val + len(hits)} of {dept} courses...")
            if len(hits) < page_size:
                break
            from_val += page_size
            time.sleep(0.3)
        
        all_courses.extend(dept_courses)
        print(f"  Total for {dept}: {len(dept_courses)}")
        
        # Save department data
        with open(os.path.join(OUTPUT_DIR, f"courses_{dept.replace('/', '_')}.json"), "w", encoding="utf-8") as f:
            json.dump(dept_courses, f, indent=2, ensure_ascii=False)
    
    # Also try without department filter to catch any missed courses
    print("\nFetching courses without department filter...")
    from_val = 0
    no_dept_courses = []
    while True:
        result = fetch_page(from_val, 100)
        if not result:
            break
        hits = result.get("hits", {}).get("hits", [])
        if not hits or from_val > 8000:
            break
        for hit in hits:
            course = extract_course(hit)
            if course["id"] not in {c["id"] for c in all_courses}:
                no_dept_courses.append(course)
        print(f"  Fetched {from_val + len(hits)}...")
        from_val += 100
        time.sleep(0.3)
    
    all_courses.extend(no_dept_courses)
    
    # Save combined data
    combined_path = os.path.join(OUTPUT_DIR, "all_courses.json")
    with open(combined_path, "w", encoding="utf-8") as f:
        json.dump(all_courses, f, indent=2, ensure_ascii=False)
    
    print(f"\n=== COMPLETE ===")
    print(f"Total courses: {len(all_courses)}")
    print(f"Saved to: {combined_path}")
    
    # Save a summary
    dept_counts = {}
    for c in all_courses:
        d = c.get("department", c.get("department_name", "Unknown"))
        dept_counts[d] = dept_counts.get(d, 0) + 1
    
    print("\nCourses per department:")
    for d, count in sorted(dept_counts.items(), key=lambda x: -x[1]):
        print(f"  {d}: {count}")
    
    return all_courses

def scrape_from_ocw_direct():
    """Fallback: Scrape from the OCW direct API."""
    print("Trying direct OCW API...")
    courses = []
    
    # Try the learning_resources API
    base = "https://ocw.mit.edu/api/v1/learning_resources/"
    params = {
        "limit": 100,
        "offset": 0,
        "resource_type": "course",
        "offered_by": "OCW"
    }
    
    while True:
        try:
            r = requests.get(base, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
            if r.status_code != 200:
                print(f"Error: {r.status_code}")
                break
            data = r.json()
            results = data.get("results", [])
            if not results:
                break
            
            for item in results:
                courses.append({
                    "id": item.get("id", ""),
                    "title": item.get("title", ""),
                    "description": item.get("description", "")[:300] if item.get("description") else "",
                    "coursenum": item.get("readable_id", ""),
                    "department": item.get("department", ""),
                    "level": item.get("level", []),
                    "topics": item.get("topics", []),
                    "url": item.get("url", ""),
                    "image_src": item.get("image_src", ""),
                    "course_feature_tags": item.get("course_feature_tags", []),
                })
            
            print(f"  Fetched {params['offset'] + len(results)} courses...")
            if len(results) < params["limit"]:
                break
            params["offset"] += params["limit"]
            time.sleep(0.3)
        except Exception as e:
            print(f"Error: {e}")
            break
    
    return courses

if __name__ == "__main__":
    courses = scrape_all_courses()
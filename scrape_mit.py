"""
MIT OCW Data Scraper
Finds courses, departments, and prerequisite information from MIT OCW.
"""
import requests
import json
import re
import time
import os

BASE = "https://ocw.mit.edu"

# First, let's find the actual API endpoints
# MIT OCW likely uses a headless CMS or has API endpoints for the React app

def explore_endpoints():
    """Try various potential API URLs"""
    endpoints = [
        "/api/v0/courses/",
        "/api/v1/courses/",
        "/api/courses/",
        "/courses/json/",
        "/courses/index.json",
        "/search/?type=course&format=json",
        "/api/search/",
        "/api/courses-list/",
        "/_data/courses.json",
        "/courses/",
    ]
    
    for ep in endpoints:
        url = BASE + ep
        try:
            r = requests.get(url, timeout=10, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json, text/html"
            })
            content_type = r.headers.get("content-type", "")
            print(f"\n{url}")
            print(f"  Status: {r.status_code}, Type: {content_type}")
            print(f"  Length: {len(r.text)}")
            if "json" in content_type:
                print(f"  JSON: {r.text[:500]}")
            elif r.status_code == 200:
                print(f"  HTML: {r.text[:300]}")
        except Exception as e:
            print(f"\n{url} -> Error: {e}")
        time.sleep(0.5)

def find_js_api_endpoints():
    """Look for API endpoints in the JavaScript files"""
    r = requests.get(BASE + "/courses/", headers={"User-Agent": "Mozilla/5.0"})
    # Find all JS file references
    js_files = re.findall(r'/static[^"\']+\.js[^"\']*', r.text)
    js_files += re.findall(r'/[^"\']+\.js[^"\']*', r.text)
    
    api_patterns = set()
    for js in js_files[:20]:
        js_url = BASE + js if js.startswith('/') else js
        try:
            jr = requests.get(js_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
            # Look for API-like patterns
            matches = re.findall(r'["\'`](/api[^"\'`]+)["\'`]', jr.text)
            matches += re.findall(r'["\'`](https?://[^"\'`]*api[^"\'`]+)["\'`]', jr.text)
            api_patterns.update(matches)
            print(f"JS: {js_url} -> {len(matches)} API patterns found")
        except:
            pass
        time.sleep(0.3)
    
    print("\n=== Found API Patterns ===")
    for p in sorted(api_patterns):
        print(f"  {p}")

def try_search_apis():
    """Try various search API formats"""
    searches = [
        "https://ocw.mit.edu/api/v0/search/?q=calculus&type=course",
        "https://ocw.mit.edu/api/v1/search/?q=calculus&type=course",
        "https://ocw.mit.edu/search/?q=calculus&type=course&format=json",
        "https://ocw.mit.edu/search/json/?q=calculus&type=course",
    ]
    for url in searches:
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0","Accept":"application/json"}, timeout=10)
            print(f"\n{url}")
            print(f"  Status: {r.status_code}, Content-Type: {r.headers.get('content-type','')}")
            print(f"  Body: {r.text[:500]}")
        except Exception as e:
            print(f"\n{url} -> Error: {e}")

def scrape_department_pages():
    """Get course listings from department pages"""
    departments = [
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "11", "12", "14", "15", "16", "17", "18", "20", "21A",
        "21G", "21H", "21L", "21M", "22", "24", "STS", "WGS"
    ]
    
    for dept in departments:
        url = f"https://ocw.mit.edu/courses/{dept}/"
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            print(f"\n{url} -> Status: {r.status_code}, Size: {len(r.text)}")
            # Find course links
            course_links = re.findall(r'href="(/courses/[^"]+)"', r.text)
            print(f"  Found {len(course_links)} course links")
            if len(course_links) > 0:
                print(f"  Sample: {course_links[:5]}")
        except Exception as e:
            print(f"\n{url} -> Error: {e}")
        time.sleep(1)

def scrape_main_courses_page():
    """Scrape the main courses listing page"""
    r = requests.get("https://ocw.mit.edu/courses/", headers={"User-Agent": "Mozilla/5.0"})
    print(f"Status: {r.status_code}, Size: {len(r.text)}")
    
    # Save for analysis
    with open("courses_main_page.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    
    # Look for data patterns
    # React apps often have __NEXT_DATA__ or similar
    data_match = re.findall(r'__NEXT_DATA__\s*=\s*({.*?});', r.text, re.DOTALL)
    if data_match:
        print("Found __NEXT_DATA__!")
    else:
        # Look for <script> with embedded data
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', r.text, re.DOTALL)
        print(f"Found {len(scripts)} script tags")
        for i, s in enumerate(scripts):
            if 'window.' in s and ('data' in s.lower() or 'props' in s.lower()):
                print(f"Script {i}: {s[:200]}...")
    
    # Look for API calls in inline scripts
    api_refs = re.findall(r'(/api/[^"\'\s]+)', r.text)
    print(f"API references: {api_refs[:20]}")

def check_static_data_files():
    """Try to find static JSON data files"""
    urls = [
        "https://ocw.mit.edu/static/courses.json",
        "https://ocw.mit.edu/data/courses.json",
        "https://ocw.mit.edu/courses.json",
        "https://ocw.mit.edu/static/data/courses.json",
        "https://ocw.mit.edu/course-data.json",
    ]
    for url in urls:
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
            print(f"{url} -> {r.status_code} ({r.headers.get('content-type','')}) - {len(r.text)} bytes")
            if r.status_code == 200 and 'json' in r.headers.get('content-type', ''):
                print(r.text[:500])
        except Exception as e:
            print(f"{url} -> Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("MIT OCW API EXPLORATION")
    print("=" * 60)
    
    print("\n--- 1. Checking static data files ---")
    check_static_data_files()
    
    print("\n--- 2. Scraping main courses page ---")
    scrape_main_courses_page()
    
    time.sleep(2)
    
    print("\n--- 3. Exploring API endpoints ---")
    explore_endpoints()
    
    print("\n\nAll exploration complete. Check console output above.")
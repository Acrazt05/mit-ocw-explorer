"""Search JS files for API endpoints"""
import re

with open('mit_js.js', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"JS file size: {len(content)} chars")

# Look for API-related strings
patterns = [
    r'"([^"]*api[^"]*)"',
    r"'([^']*api[^']*)'",
    r'"([^"]*search[^"]*)"',
    r"'([^']*search[^']*)'",
    r'"([^"]*ocw-api[^"]*)"',
    r"'(openlearning|ocw-server|[^']*api[^']*)'",
    r'fetch\s*\(\s*["\']([^"\']+)["\']',
    r'axios\s*\.\s*(?:get|post)\s*\(\s*["\']([^"\']+)["\']',
    r'https?://[^"\'\s]+',
]

all_urls = set()
for pat in patterns:
    matches = re.findall(pat, content, re.IGNORECASE)
    for m in matches:
        if m and len(m) > 2:
            all_urls.add(m)

# Filter for likely API/data URLs
interesting = [u for u in all_urls if any(kw in u.lower() for kw in ['api', 'search', 'course', 'ocw', 'graphql', 'json', 'data'])]

print("\n=== Interesting URLs in JS ===")
for u in sorted(interesting)[:50]:
    print(f"  {u}")

# Also search for structured data that might be embedded
print("\n=== Looking for embedded data structures ===")
if 'courses' in content.lower():
    # Find where courses are mentioned
    idx = content.lower().find('courses')
    print(f"First 'courses' at index {idx}: ...{content[max(0,idx-100):idx+200]}...")
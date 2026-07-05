"""
Build the data.js file from scraped course data.
Transforms and enriches course data for the interactive map.
"""
import json
import os

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(os.path.dirname(BASE), "data")

with open(os.path.join(DATA_DIR, "all_courses.json"), "r", encoding="utf-8") as f:
    courses = json.load(f)

# Department color mapping
DEPT_COLORS = {
    "Mathematics": "#ff6b6b",
    "Physics": "#4ecdc4",
    "Electrical Engineering and Computer Science": "#ffd93d",
    "Biology": "#6bcb77",
    "Chemistry": "#ff922b",
    "Economics": "#845ef7",
    "Mechanical Engineering": "#20c997",
    "Chemical Engineering": "#339af0",
    "Aeronautics and Astronautics": "#f06595",
    "Civil and Environmental Engineering": "#74c0fc",
    "Materials Science and Engineering": "#da77f2",
    "Nuclear Science and Engineering": "#ff8787",
    "Biological Engineering": "#63e6be",
    "Brain and Cognitive Sciences": "#ffc9ff",
    "Linguistics and Philosophy": "#a9e34b",
    "Political Science": "#4dabf7",
    "History": "#ffa94d",
    "Literature": "#e599f7",
    "Architecture": "#69db7c",
    "Music and Theater Arts": "#f783ac",
    "Sloan School of Management": "#339af0",
    "Urban Studies and Planning": "#ffe066",
    "Anthropology": "#c0eb75",
    "Comparative Media Studies/Writing": "#b197fc",
    "Earth, Atmospheric, and Planetary Sciences": "#63e6be",
    "Global Studies and Languages": "#ffa8a8",
    "Health Sciences and Technology": "#74c0fc",
    "Media Arts and Sciences": "#fcc2d7",
    "Science, Technology, and Society": "#96f2d7",
    "Women's and Gender Studies": "#f783ac",
}

# Map course numbers to departments for prerequisite inference
DEPT_PREFIX = {
    "1": "Civil and Environmental Engineering",
    "2": "Mechanical Engineering",
    "3": "Materials Science and Engineering",
    "4": "Architecture",
    "5": "Chemistry",
    "6": "Electrical Engineering and Computer Science",
    "7": "Biology",
    "8": "Physics",
    "9": "Brain and Cognitive Sciences",
    "10": "Chemical Engineering",
    "11": "Urban Studies and Planning",
    "12": "Earth, Atmospheric, and Planetary Sciences",
    "14": "Economics",
    "15": "Sloan School of Management",
    "16": "Aeronautics and Astronautics",
    "17": "Political Science",
    "18": "Mathematics",
    "20": "Biological Engineering",
    "21A": "Anthropology",
    "21G": "Global Studies and Languages",
    "21H": "History",
    "21L": "Literature",
    "21M": "Music and Theater Arts",
    "22": "Nuclear Science and Engineering",
    "24": "Linguistics and Philosophy",
    "STS": "Science, Technology, and Society",
    "WGS": "Women's and Gender Studies",
    "CMS": "Comparative Media Studies/Writing",
    "ES": "Experimental Study Group",
    "HST": "Health Sciences and Technology",
    "MAS": "Media Arts and Sciences",
    "IDS": "Institute for Data, Systems, and Society",
}

def get_level(course):
    """Derive course level from course number (MIT convention).
    <100 = Undergraduate, 100-199 = Mixed/Upper UG, 200+ = Graduate."""
    num = course.get("coursenum", "").strip()
    levels = []
    # Try to extract numeric part
    if num:
        parts = num.split(".")
        if len(parts) >= 2:
            try:
                n = int(parts[1][:3] if parts[1] else "0")
                if n < 100: levels.append("Undergraduate")
                if n >= 50: levels.append("Graduate")
            except: pass
    # Fallback: if course level already present in source data
    if course.get("level"):
        return course["level"]
    return levels if levels else ["Undergraduate"]

def get_dept(course):
    """Get department name from course number prefix."""
    dept_list = course.get("department", [])
    if isinstance(dept_list, list) and dept_list:
        return dept_list[0]
    num = course.get("coursenum", "")
    if num:
        prefix = num.split(".")[0]
        for p, dept in DEPT_PREFIX.items():
            if prefix == p or prefix.startswith(p):
                return dept
    return "Other"

def get_dept_color(course):
    """Get department color."""
    dept = get_dept(course)
    return DEPT_COLORS.get(dept, "#9090b0")

def get_group(course):
    """Get the broad field group for layout."""
    dept = get_dept(course)
    groups = {
        "Mathematics": "math",
        "Physics": "physics",
        "Electrical Engineering and Computer Science": "eecs",
        "Biology": "biology",
        "Chemistry": "chemistry",
        "Economics": "economics",
        "Mechanical Engineering": "engineering",
        "Chemical Engineering": "engineering",
        "Aeronautics and Astronautics": "engineering",
        "Civil and Environmental Engineering": "engineering",
        "Materials Science and Engineering": "engineering",
        "Nuclear Science and Engineering": "engineering",
        "Biological Engineering": "biology",
        "Brain and Cognitive Sciences": "science",
        "Linguistics and Philosophy": "humanities",
        "Political Science": "humanities",
        "History": "humanities",
        "Literature": "humanities",
        "Architecture": "humanities",
        "Music and Theater Arts": "humanities",
        "Sloan School of Management": "management",
        "Urban Studies and Planning": "humanities",
        "Anthropology": "humanities",
        "Comparative Media Studies/Writing": "humanities",
        "Earth, Atmospheric, and Planetary Sciences": "science",
        "Global Studies and Languages": "humanities",
        "Health Sciences and Technology": "biology",
        "Media Arts and Sciences": "eecs",
        "Science, Technology, and Society": "humanities",
        "Women's and Gender Studies": "humanities",
    }
    return groups.get(dept, "other")

# Build lookup by coursenum
course_map = {}
for c in courses:
    num = c.get("coursenum", "").strip()
    if num:
        course_map[num] = c

# Build the processed data - deduplicate by course number
seen_nums = set()
output = []
for c in courses:
    num = c.get("coursenum", "").strip()
    if not num or num in seen_nums:
        continue
    seen_nums.add(num)
    dept = get_dept(c)
    output.append({
        "id": num,
        "title": c.get("title", ""),
        "description": (c.get("description", "") or "")[:200],
        "department": dept,
        "level": get_level(c),
        "topics": c.get("topics", []),
        "url": f"https://ocw.mit.edu/courses/{c.get('run_title', '')}" if c.get("run_title") else c.get("url", ""),
        "image": c.get("image_src", ""),
        "features": c.get("course_feature_tags", []),
        "color": get_dept_color(c),
        "group": get_group(c),
        "sourceId": c.get("id"),
    })

# Write the data.js file
with open(os.path.join(BASE, "data.js"), "w", encoding="utf-8") as f:
    f.write("// MIT OCW Course Data - Auto-generated from MIT OCW API\n")
    f.write(f"// Total courses: {len(output)} (deduplicated from {len(courses)} raw)\n")
    f.write(f"// Generated: {__import__('datetime').datetime.now().isoformat()}\n")
    f.write("const COURSES = ")
    json.dump(output, f, ensure_ascii=False)
    f.write(";\n")
    
    # Also write a lookup by coursenum
    f.write("const COURSE_MAP = {};\n")
    f.write("COURSES.forEach(c => { COURSE_MAP[c.id] = c; });\n")
    
    # Department list for filters
    depts = sorted(set(c["department"] for c in output))
    f.write(f"const DEPARTMENTS = {json.dumps(depts)};\n")
    
    # Group categories
    groups = sorted(set(c["group"] for c in output))
    f.write(f"const GROUPS = {json.dumps(groups)};\n")

print(f"Built data.js with {len(output)} courses")
print(f"Departments: {len(depts)}")
print(f"Groups: {groups}")
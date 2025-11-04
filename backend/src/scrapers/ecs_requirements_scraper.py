import requests
from bs4 import BeautifulSoup
import json
import re
import os

BASE_URL = "https://courses.syracuse.edu/preview_program.php?catoid=38&poid="

PROGRAM_IDS = {
    "Aerospace Engineering": "19215",
    "Bioengineering": "19216",
    "Chemical Engineering": "19217",
    "Civil Engineering": "19213",
    "Computer Engineering": "19220",
    "Computer Science": "19219",
    "Electrical Engineering": "19223",
    "Environmental Engineering": "19228",
    "Mechanical Engineering": "19230",
    "Systems & Information Science": "19224"
}

def scrape_program_requirements(program_name, poid):
    url = f"{BASE_URL}{poid}"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")

    # Find all acalog-core divs
    acalog_divs = soup.find_all("div", class_="acalog-core")
    if not acalog_divs:
        return {"program": program_name, "error": "No content found"}

    requirements = {"program": program_name, "total_credits": None, "categories": {}}

    # Look for total credits information throughout the page content
    full_text = " ".join([div.get_text(" ", strip=True) for div in acalog_divs])
    credit_match = re.search(r"(\d{2,3}(?:-\d{2,3})?)\s*credits? required", full_text, re.I) or \
                  re.search(r"minimum of (\d{2,3}(?:-\d{2,3})?)\s*credits", full_text, re.I) or \
                  re.search(r"requires (\d{2,3}(?:-\d{2,3})?)\s*credits", full_text, re.I) or \
                  re.search(r"(\d{2,3}(?:-\d{2,3})?)\s*credits", full_text, re.I)
    
    requirements["total_credits"] = credit_match.group(1) + " credits" if credit_match else None

    # Keep track of core requirements and electives
    core_requirements = []
    technical_electives = []
    other_requirements = {}

    # Process each acalog-core div section
    for div in acalog_divs:
        # Find heading elements
        headings = div.find_all(["h2", "h3", "h4"])
        
        for heading in headings:
            category_name = heading.get_text(strip=True).strip()
            # Skip certain headings that don't contain course requirements
            if any(skip in category_name.lower() for skip in [
                "learning outcomes", "academic standards", "intra-university", 
                "student learning", "advisement", "distribution", "program of study"
            ]):
                continue
                
            # Find course lists
            courses = []
            next_elem = heading.find_next_sibling()
            
            while next_elem and next_elem.name not in ["h2", "h3", "h4"]:
                # Look for course links in the section
                if next_elem.name in ["ul", "ol"]:
                    for li in next_elem.find_all("li", class_="acalog-course"):
                        course_link = li.find("a")
                        if course_link:
                            course_text = course_link.get_text(strip=True)
                            course_code_match = re.search(r'([A-Z]{2,4}\s\d{3}[A-Z]?)', course_text)
                            if course_code_match:
                                course_code = course_code_match.group(1)
                                course_name = course_text.split("-", 1)[1].strip() if "-" in course_text else ""
                                course_info = {
                                    "code": course_code,
                                    "name": course_name
                                }
                                courses.append(course_info)
                    
                    # Look for non-course list items that might contain course information
                    for li in next_elem.find_all("li"):
                        if "acalog-course" not in li.get("class", []):
                            li_text = li.get_text(strip=True)
                            # Look for course codes like "XXX 123" in the text
                            course_codes = re.findall(r'([A-Z]{2,4}\s\d{3}[A-Z]?)', li_text)
                            for code in course_codes:
                                if not any(c.get("code") == code for c in courses):
                                    courses.append({"code": code, "name": ""})
                
                # Look for direct course links
                for a_tag in next_elem.find_all("a", href=True):
                    if "preview_course" in a_tag.get("href", ""):
                        course_text = a_tag.get_text(strip=True)
                        course_code_match = re.search(r'([A-Z]{2,4}\s\d{3}[A-Z]?)', course_text)
                        if course_code_match:
                            course_code = course_code_match.group(1)
                            if not any(c.get("code") == course_code for c in courses):
                                courses.append({"code": course_code, "name": ""})
                
                # Extract text to look for course mentions
                p_text = next_elem.get_text(strip=True) if next_elem.name == "p" else ""
                course_codes = re.findall(r'([A-Z]{2,4}\s\d{3}[A-Z]?)', p_text)
                for code in course_codes:
                    if not any(c.get("code") == code for c in courses):
                        courses.append({"code": code, "name": ""})
                
                next_elem = next_elem.find_next_sibling()
            
            if courses:
                # Categorize the courses based on section names
                if "core" in category_name.lower():
                    core_requirements.extend(courses)
                elif "technical elective" in category_name.lower() or "upper division" in category_name.lower():
                    technical_electives.extend(courses)
                else:
                    other_requirements[category_name] = courses
    
    # Add categorized courses to requirements
    if core_requirements:
        requirements["categories"]["Core Requirements"] = core_requirements
    if technical_electives:
        requirements["categories"]["Technical Electives"] = technical_electives
    
    # Add other categories
    for category, courses in other_requirements.items():
        if category not in requirements["categories"]:
            requirements["categories"][category] = courses

    return requirements

def main():
    all_requirements = []
    for program_name, poid in PROGRAM_IDS.items():
        print(f"Scraping {program_name}...")
        data = scrape_program_requirements(program_name, poid)
        all_requirements.append(data)

    # Define the output directory and filename
    output_dir = "app_data"
    output_filename = "ecs_requirements_cleaned.json"
    output_path = os.path.join(output_dir, output_filename)

    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Write the file to the correct path
    print(f"Saving requirements data to: {output_path}")
    with open(output_path, "w") as f:
        json.dump(all_requirements, f, indent=2)

    return all_requirements

if __name__ == "__main__":
    requirements = main()
    print(json.dumps(requirements, indent=2))



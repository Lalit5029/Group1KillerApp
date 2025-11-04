import re
import time
import pickle
import os
import pandas as pd
import requests # Added for making HTTP requests
import json # Added for parsing JSON

# Import undetected_chromedriver
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidCookieDomainException, JavascriptException

# --- Configuration ---
DEGREE_WORKS_URL = "https://degreeworks.syr.edu/worksheets/WEB31"
# API Endpoints
API_MYSELF_URL = "https://degreeworks.syr.edu/api/myself" # Endpoint to get current user info
# !! IMPORTANT: Verify this API endpoint and parameters from browser DevTools !!
API_AUDIT_URL_TEMPLATE = "https://degreeworks.syr.edu/api/audit?studentId={student_id}&school=UGRD&degree=BS&is-processNew=false&audit-type=AA&auditId=&include-inprogress=true&include-preregistered=true&aid-term="

COOKIE_FILE = "degree_works_cookies.pkl"
COOKIE_DOMAIN_URL = "https://degreeworks.syr.edu/"
WAIT_TIMEOUT = 60 # Timeout for general waits

# Base Headers (User-Agent will be added dynamically)
BASE_REQUEST_HEADERS = {
    'accept': 'application/vnd.net.hedtech.degreeworks.dashboard.audit.v1+json', # Specific accept for audit
    'accept-language': 'en-US,en;q=0.9',
    'dnt': '1',
    'referer': 'https://degreeworks.syr.edu/worksheets/WEB31',
    # 'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"', # Removed - less critical, hard to get dynamically
    # 'sec-ch-ua-mobile': '?0',
    # 'sec-ch-ua-platform': '"macOS"', # Removed
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    # User-Agent will be added dynamically
}
# Headers for /myself endpoint
MYSELF_BASE_HEADERS = BASE_REQUEST_HEADERS.copy()
MYSELF_BASE_HEADERS['accept'] = 'application/json, text/plain, */*' # More generic accept


# --- Helper Functions ---

def setup_driver():
    """Sets up the undetected Chrome WebDriver and returns driver + user agent."""
    print("🔧 Setting up undetected-chromedriver...")
    driver = None
    user_agent = None
    try:
        options = uc.ChromeOptions()
        options.add_argument("start-maximized")
        options.add_argument('--disable-blink-features=AutomationControlled')
        driver = uc.Chrome(options=options, use_subprocess=True)
        print("✅ Undetected chromedriver initialized.")
        # Get the dynamic user agent from the browser instance
        user_agent = driver.execute_script("return navigator.userAgent;")
        print(f"   Detected User-Agent: {user_agent}")
        return driver, user_agent
    except Exception as e:
        print(f"❌ Failed to initialize undetected-chromedriver: {e}")
        print("   Ensure undetected-chromedriver is installed (`pip install undetected-chromedriver`)")
        print("   Also ensure a compatible Chrome browser is installed.")
        if driver:
            driver.quit()
        return None, None

# Modified save_cookies to return the cookies list
def save_cookies(driver):
    """Guides manual login and saves/returns cookies."""
    if not driver:
        print("❌ Driver not initialized, cannot save cookies.")
        return None
    driver.get(DEGREE_WORKS_URL) # Start at the target page
    print("\n" + "="*40)
    print("⚠️ ACTION REQUIRED: Manual Login Needed ⚠️")
    print("="*40)
    print(f"1. The browser window requires you to log in via Syracuse University SSO.")
    print(f"2. Complete the login process (including any multi-factor authentication).")
    print(f"3. You should land on the Degree Works page: {DEGREE_WORKS_URL}")
    print(f"4. Wait for the audit content (course tables) to fully load.")
    input("5. Once the Degree Works page is fully loaded, press Enter here...")

    # Verify we are on the correct page after login
    try:
        WebDriverWait(driver, WAIT_TIMEOUT).until(
             lambda d: DEGREE_WORKS_URL in d.current_url
        )
        print(f"✅ On Degree Works page: {driver.current_url}")
    except TimeoutException:
        print(f"❌ Error: Did not land on the expected Degree Works page after login.")
        print(f"   Current URL: {driver.current_url}")
        print(f"   Please ensure login was successful and landed on the correct page.")
        return None # Indicate failure

    print("Pausing for 5 seconds to ensure all cookies are set...")
    time.sleep(5)
    try:
        print("Attempting to save cookies...")
        current_cookies = driver.get_cookies()
        # Filter for necessary cookies for the degreeworks domain
        valid_cookies = [c for c in current_cookies if 'degreeworks.syr.edu' in c.get('domain', '')]

        if not any(c['name'] == 'X-AUTH-TOKEN' for c in valid_cookies):
             print("❌ Error: X-AUTH-TOKEN cookie not found after login.")
             return None

        with open(COOKIE_FILE, "wb") as f:
            pickle.dump(valid_cookies, f)
        print(f"✅ {len(valid_cookies)} Cookies saved to {COOKIE_FILE}")
        return valid_cookies # Return the list of cookies
    except Exception as e:
        print(f"❌ Error saving cookies: {e}")
        return None

# --- API Call Functions ---

def get_student_info_api(saved_cookies, user_agent):
    """Fetches user info (including student ID) from the /api/myself endpoint."""
    if not saved_cookies:
        print("❌ Cannot fetch user info: No cookies provided.")
        return None
    if not user_agent:
         print("❌ Cannot fetch user info: No User-Agent provided.")
         return None

    cookies_dict = {cookie['name']: cookie['value'] for cookie in saved_cookies}
    # Create request-specific headers and add dynamic User-Agent
    request_headers = MYSELF_BASE_HEADERS.copy()
    request_headers['user-agent'] = user_agent

    print(f"📡 Making API request to: {API_MYSELF_URL}")

    try:
        response = requests.get(API_MYSELF_URL, headers=request_headers, cookies=cookies_dict, timeout=30)
        print(f"   Response Status Code (/myself): {response.status_code}")

        if response.status_code == 200:
            user_data = response.json()
            # --- IMPORTANT: Adjust key based on actual JSON response ---
            student_id = user_data.get('internalId') # Common key for student ID
            if student_id:
                print(f"✅ Found Student ID (internalId): {student_id}")
                return str(student_id) # Return as string
            else:
                print("❌ Error: 'internalId' not found in /api/myself response.")
                print(f"   Response Data: {user_data}")
                return None
        else:
            print(f"❌ /api/myself request failed with status {response.status_code}.")
            print(f"   Response Text: {response.text[:500]}...")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during /api/myself request: {e}")
        return None
    except json.JSONDecodeError:
        print("❌ Error: Failed to decode JSON response from /api/myself.")
        print(f"   Response Text: {response.text[:500]}...")
        return None
    except Exception as e:
        print(f"❌ An unexpected error occurred during /api/myself request: {e}")
        return None


def fetch_audit_data_api(saved_cookies, student_id, user_agent):
    """Fetches audit data using the API, cookies, student ID, and user agent."""
    if not saved_cookies or not student_id or not user_agent:
        print("❌ Cannot fetch API data: Missing cookies, student ID, or user agent.")
        return None

    cookies_dict = {cookie['name']: cookie['value'] for cookie in saved_cookies}
    print(f"🍪 Using cookies for API request: {list(cookies_dict.keys())}")

    # Create request-specific headers and add dynamic User-Agent
    request_headers = REQUEST_HEADERS.copy()
    request_headers['user-agent'] = user_agent

    # Construct the specific API URL using the fetched student ID
    # ** VERIFY OTHER PARAMETERS (school, degree, audit-type) **
    api_url = API_AUDIT_URL_TEMPLATE.format(student_id=student_id)
    print(f"📡 Making API request to: {api_url}")

    try:
        response = requests.get(api_url, headers=request_headers, cookies=cookies_dict, timeout=60)
        print(f"   Response Status Code (/api/audit): {response.status_code}")

        if response.status_code == 200:
            print("✅ API request successful.")
            try:
                audit_data = response.json()
                try:
                    with open("degree_works_api_response.json", "w", encoding="utf-8") as f:
                        json.dump(audit_data, f, indent=4)
                    print("   Saved raw API response to degree_works_api_response.json")
                except Exception as save_e:
                    print(f"   ⚠️ Warning: Could not save API response to file: {save_e}")
                return audit_data
            except json.JSONDecodeError:
                print("❌ Error: Failed to decode JSON response from API.")
                print(f"   Response Text: {response.text[:500]}...")
                return None
        else:
            print(f"❌ API request failed with status {response.status_code}.")
            print(f"   Response Headers: {response.headers}")
            print(f"   Response Text: {response.text[:500]}...")
            if response.status_code == 403:
                print("   Received 403 Forbidden. Check cookies, headers (especially Referer, User-Agent), and API URL parameters.")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during API request: {e}")
        return None
    except Exception as e:
        print(f"❌ An unexpected error occurred during API request: {e}")
        return None

# --- Integrated JSON Parsing Function (from user) ---
def parse_audit_json(audit_data):
    """Parses course data from the audit JSON structure."""
    if not audit_data:
        print("ℹ️ No audit data provided to parse.")
        return [], {}

    print("ℹ️ Starting JSON parsing...")
    course_metadata = {}
    course_to_group = {}
    catalog_group = None

    try:
        # --- 1. Extract course title + term info from classInformation ---
        if "classInformation" in audit_data and "classArray" in audit_data["classInformation"]:
            for c in audit_data["classInformation"]["classArray"]:
                key = f"{c.get('discipline', '')} {c.get('number', '')}".strip()
                if key:
                    course_metadata[key] = {
                        "title": c.get("courseTitle"),
                        "term": c.get("termLiteral"),
                        "grade": c.get("grade"),
                        "credits": c.get("credits")
                    }
            print(f"   Extracted metadata for {len(course_metadata)} courses from classInformation.")
        else:
            print("   ⚠️ Could not find classInformation.classArray in JSON data.")

        # --- 2. Map courses to requirement groups (labels) from blockArray ---
        def map_courses_to_group_with_parent(rules, parent_label=None):
            """Recursively maps courses found in rules to their effective label."""
            for rule in rules:
                label = rule.get("label")
                effective_label = parent_label if label is None else label
                if "classesAppliedToRule" in rule:
                    for cls in rule["classesAppliedToRule"].get("classArray", []):
                        key = f"{cls.get('discipline', '')} {cls.get('number', '')}".strip()
                        if key:
                            if key not in course_to_group or parent_label is None:
                                course_to_group[key] = effective_label
                if "ruleArray" in rule:
                    map_courses_to_group_with_parent(rule["ruleArray"], effective_label)
                if "ifPart" in rule and "ruleArray" in rule["ifPart"]:
                    map_courses_to_group_with_parent(rule["ifPart"]["ruleArray"], effective_label)
                if "elsePart" in rule and "ruleArray" in rule["elsePart"]:
                    map_courses_to_group_with_parent(rule["elsePart"]["ruleArray"], effective_label)

        if "blockArray" in audit_data:
            for block in audit_data["blockArray"]:
                block_title = block.get('title', 'Unknown Block')
                if "ruleArray" in block:
                    map_courses_to_group_with_parent(block["ruleArray"], block_title)
            print(f"   Mapped {len(course_to_group)} courses to requirement groups.")
        else:
             print("   ⚠️ Could not find blockArray in JSON data.")

        # --- 3. Infer catalog group (e.g., Major code) ---
        def extract_major_code(node):
            if isinstance(node, dict):
                if "relationalOperator" in node:
                    op = node["relationalOperator"]
                    if op.get("left") == "MAJOR" and "right" in op:
                        return op.get("right")
                major_code = None
                if "leftCondition" in node:
                    major_code = extract_major_code(node["leftCondition"])
                if not major_code and "rightCondition" in node:
                    major_code = extract_major_code(node["rightCondition"])
                return major_code
            return None

        def find_major_code(rules):
            for rule in rules:
                req = rule.get("requirement", {})
                major = extract_major_code(req)
                if major: return major
                if "ruleArray" in rule:
                    result = find_major_code(rule["ruleArray"])
                    if result: return result
                if "ifPart" in rule and "ruleArray" in rule["ifPart"]:
                    result = find_major_code(rule["ifPart"]["ruleArray"])
                    if result: return result
                if "elsePart" in rule and "ruleArray" in rule["elsePart"]:
                    result = find_major_code(rule["elsePart"]["ruleArray"])
                    if result: return result
            return None

        if "blockArray" in audit_data:
            for block in audit_data.get("blockArray", []):
                 if block.get("blockType") == "MAJOR" or "Major" in block.get("title", ""):
                    if "ruleArray" in block:
                        catalog_group = find_major_code(block["ruleArray"])
                        if catalog_group:
                            print(f"   Inferred Catalog Group (Major Code): {catalog_group}")
                            break
            if not catalog_group:
                 print("   ⚠️ Could not infer Catalog Group (Major Code).")
        else:
             print("   ⚠️ Could not find blockArray to infer Catalog Group.")

        # --- 4. Build final course list ---
        final_output = []
        if "classInformation" in audit_data and "classArray" in audit_data["classInformation"]:
            for cls in audit_data["classInformation"]["classArray"]:
                key = f"{cls.get('discipline', '')} {cls.get('number', '')}".strip()
                if not key: continue

                meta = course_metadata.get(key, {})
                req_group = course_to_group.get(key)
                grade = cls.get("grade")
                grade_value = grade.get("value") if isinstance(grade, dict) else grade
                credits = cls.get("credits")

                status = 'Not Taken'
                grade_upper = grade_value.upper() if isinstance(grade_value, str) else ''
                if grade_upper == 'IP': status = 'In Progress'
                elif grade_upper in ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'P', 'S', 'CR']: status = 'Taken'
                elif grade_upper in ['WD', 'W', 'F', 'U', 'I', 'N', 'NG', 'AU']: status = 'Not Taken'

                final_output.append({
                    "course": key,
                    "title": meta.get("title"),
                    "grade": grade_value if grade_value else 'N/A',
                    "credits": float(credits) if credits else 0.0,
                    "term": meta.get("term"),
                    "catalogGroup": catalog_group,
                    "requirementGroup": req_group,
                    "status": status
                })
            if not final_output:
                 print("   ⚠️ No courses added to final output. Check classInformation structure.")

        # Save the intermediate parsed data
        try:
            with open("parsed_courses.json", "w", encoding='utf-8') as f:
                json.dump(final_output, f, indent=2)
            print("   Saved parsed course data to parsed_courses.json")
        except Exception as save_e:
            print(f"   ⚠️ Warning: Could not save parsed_courses.json: {save_e}")

        # Calculate credits
        credits_info = calculate_credits(final_output)

        return final_output, credits_info # Return the list and credits info

    except Exception as e:
        print(f"❌ Error during JSON parsing: {e}")
        print("   Please examine 'degree_works_api_response.json' to understand the structure.")
        return [], {}

# --- calculate_credits function (remains the same) ---
def calculate_credits(courses, total_credits_required=120):
    """Calculates credit summary."""
    def safe_float(value):
        try: return float(value)
        except (ValueError, TypeError): return 0.0
    credits_earned = sum(safe_float(c['credits']) for c in courses if c.get('status') == 'Taken')
    credits_in_progress = sum(safe_float(c['credits']) for c in courses if c.get('status') == 'In Progress')
    credits_needed = max(0, total_credits_required - credits_earned)
    return {'credits_earned': credits_earned, 'credits_in_progress': credits_in_progress, 'credits_needed': credits_needed}

# --- Main Execution Logic ---
def main():
    """Main function to orchestrate login, API fetch, and saving."""
    print("🚀 Starting Degree Works Scraper (API Version)...")
    driver, user_agent = setup_driver() # Get driver and user_agent
    if not driver or not user_agent:
        print("❌ Exiting due to driver setup failure.")
        return

    api_audit_data = None
    saved_cookies = None
    student_id = None

    try:
        # Always force manual login to get fresh cookies for API call
        print("\nInitiating manual login process to obtain fresh cookies...")
        saved_cookies = save_cookies(driver)

        if saved_cookies:
             # Get student ID dynamically
             print("\nFetching student information...")
             # Pass the dynamic user_agent to the API call
             student_id = get_student_info_api(saved_cookies, user_agent)

             if student_id:
                # Now call the function to fetch data via API
                # Pass the dynamic user_agent to the API call
                api_audit_data = fetch_audit_data_api(saved_cookies, student_id, user_agent)
             else:
                print("❌ Could not retrieve student ID. Cannot fetch audit.")
        else:
             print("❌ Manual login/cookie saving failed. Cannot proceed.")

    finally:
        if driver:
            print("Quitting WebDriver...")
            driver.quit()

    # --- Process Results ---
    if api_audit_data:
        print("\nParsing API audit data...")
        courses, credits_info = parse_audit_json(api_audit_data)

        if not courses:
            print("\n⚠️ API data retrieved, but no course entries were parsed.")
            print("   Please examine 'degree_works_api_response.json' and update the 'parse_audit_json' function if needed.")
        else:
            print(f"\n✅ Successfully parsed {len(courses)} course entries from API data.")
            print("\n--- Credit Summary ---")
            print(f"Credits Earned (Taken):    {credits_info['credits_earned']:.2f}")
            print(f"Credits In Progress:       {credits_info['credits_in_progress']:.2f}")
            print(f"Credits Still Needed (Est):{credits_info['credits_needed']:.2f} (vs 120 total)")
            print("----------------------")
            df = pd.DataFrame(courses)
            cols_order = ['course', 'title', 'grade', 'credits', 'term', 'catalogGroup', 'requirementGroup', 'status']
            df = df[[col for col in cols_order if col in df.columns]]
            try:
                csv_filename = 'parsed_degree_works_courses.csv'
                json_filename = 'parsed_courses_dataframe.json' # Differentiate from the intermediate file
                df.to_csv(csv_filename, index=False, encoding='utf-8')
                print(f"   -> Saved CSV: {csv_filename}")
                df.to_json(json_filename, orient='records', indent=4)
                print(f"   -> Saved Parsed DataFrame JSON: {json_filename}")
                print("✅ Results saved successfully.")
            except Exception as e:
                print(f"❌ Error saving files: {e}")
    else:
        print("\n❌ Failed to fetch audit data from API. No data processed.")
        print("   Please check the console output for errors (e.g., 403 Forbidden).")
        print("   Verify API URL, parameters, and headers if necessary.")

    print("\n🚀 Scraper finished.")

if __name__ == "__main__":
    main()

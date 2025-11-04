# MySlice Academic Record Import Feature

This feature allows students to import their academic record directly from Syracuse University's MySlice portal to enhance their course scheduling experience with personalized recommendations.

## Overview

The MySlice Academic Record Import feature:

1. Securely logs into your MySlice account using Selenium WebDriver
2. Navigates to the Academic Progress page
3. Scrapes your completed courses, including:
   - Course codes
   - Course names
   - Grades earned
   - Credits
   - Terms when courses were taken
4. Uses this data to provide personalized course recommendations and performance predictions

## Prerequisites

To use this feature, you need to have the following installed:

- Python 3.6+
- Node.js 14+
- Chrome browser
- The following Python packages:
  - selenium
  - beautifulsoup4
  - webdriver-manager

You can install the required Python packages with:

```bash
pip install selenium beautifulsoup4 webdriver-manager
```

## Setup and Running

### Method 1: Run with the Web Application

1. Start the development server with the API:

```bash
npm run dev
```

2. Navigate to the Academic Progress page at http://localhost:3000/academic-progress
3. Click on "Import from MySlice" button
4. Follow the on-screen instructions to log in and complete the import

### Method 2: Run the Scraper Directly

1. Use the provided standalone script:

```bash
node backend/run_scraper.js
```

2. Follow the prompts in the terminal to log in to MySlice
3. Wait for the scraper to complete

### Method 3: Run just the API Server

1. Start the API server separately:

```bash
node backend/src/api/academic_scraper_api.js
```

2. Use the API endpoints:
   - POST to `/api/scrape-academic-record` to start a scraping job
   - GET to `/api/scrape-status/:jobId` to check job status
   - GET to `/api/academic-record` to retrieve scraped courses

## How the Scraper Works

The scraper works through the following steps:

1. **Launches Chrome**: Opens a Chrome browser window using Selenium WebDriver
2. **Login Assistance**: Navigates to MySlice login and assists you with the login process
3. **Navigation**: Automatically navigates to the Academic Record section
4. **Extraction**: Extracts course information including codes, names, grades, and credits
5. **Data Storage**: Saves the extracted data to a JSON file for use in the application

## Troubleshooting

If you encounter issues with the scraper, try these troubleshooting steps:

### Common Issues

1. **Browser Closes Too Quickly**: The scraper is designed to keep the browser open until the scraping is complete. If it closes unexpectedly, check the error logs.

2. **Navigation Problems**: MySlice's UI can change. The scraper takes screenshots during navigation to help diagnose issues:
   - Check the generated screenshots in the project folder

3. **Installation Issues**: Make sure you have Chrome installed and the correct Python packages:
   
   ```bash
   pip install --upgrade selenium beautifulsoup4 webdriver-manager
   ```

4. **Manual Login Needed**: The scraper requires you to manually log in to MySlice for security. Be ready to enter your credentials and complete 2FA if needed.

### Viewing Screenshots and Logs

The scraper saves diagnostic screenshots to help troubleshoot navigation issues:

- `login_check.png`: Status after attempting to log in
- `academics_click_error.png`: If there was an issue clicking the Academics menu
- `after_academics_click.png`: After clicking the Academics menu
- `course_history_click_error.png`: If there was an issue navigating to Course History
- `course_history_ready.png`: Course History page before scraping
- `expanded_academic_record.png`: After expanding all sections

Check these screenshots if the scraper gets stuck at a particular step.

## API Documentation

The scraper provides the following API endpoints:

### Start Scraping

```
POST /api/scrape-academic-record
```

This endpoint initiates a new scraping job. It returns a job ID that can be used to check status.

Response:
```json
{
  "jobId": "1681234567890",
  "status": "running",
  "message": "Academic record scraper started"
}
```

### Check Status

```
GET /api/scrape-status/:jobId
```

This endpoint checks the status of a scraping job.

Response:
```json
{
  "status": "completed",
  "message": "Successfully scraped 32 courses",
  "started": "2023-04-11T14:30:00.000Z",
  "completed": "2023-04-11T14:32:00.000Z",
  "log": "...",
  "result": [
    {
      "code": "CIS 151",
      "name": "Introduction to Computer Science",
      "grade": "A",
      "credits": "3",
      "term": "Fall 2022"
    },
    // More courses...
  ]
}
```

### Get Academic Record

```
GET /api/academic-record
```

This endpoint retrieves the most recently scraped academic record.

Response:
```json
[
  {
    "code": "CIS 151",
    "name": "Introduction to Computer Science",
    "grade": "A",
    "credits": "3",
    "term": "Fall 2022"
  },
  // More courses...
]
```

## Security Considerations

- **No Credential Storage**: The scraper does not store your MySlice credentials.
- **Manual Login**: You will always need to manually enter your credentials.
- **Local Processing**: All data processing happens locally on your machine.
- **Cookie Management**: Session cookies are stored temporarily to facilitate navigation but are not shared.

## Contributing

If you'd like to improve this feature, please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
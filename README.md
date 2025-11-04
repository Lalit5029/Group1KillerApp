# Course Scheduler

A modern course scheduling application built with Next.js for university students. Easily browse courses, plan your semester schedule, and manage your academic path.

## Features

- **Course Catalog:** Browse and search through available courses
- **Interactive Calendar:** View your schedule in a weekly calendar format
- **Image Import:** Import schedule screenshots directly using OCR
- **Notification System:** Receive alerts about schedule conflicts and changes
- **Responsive Design:** Works seamlessly on mobile and desktop devices
- **User Authentication:** Secure login and registration system
- **Course Auto-save:** Automatic saving of course selections
- **Academic Progress Tracking:** Monitor your degree requirements
- **MySlice Integration:** Import course history directly from MySlice

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **OCR Integration:** Tesseract.js for image text recognition
- **State Management:** React hooks and context API
- **Database:** Prisma ORM with SQLite
- **Authentication:** NextAuth.js
- **API:** Next.js API Routes
- **Browser Automation:** Puppeteer
- **HTTP Client:** Axios
- **HTML Parsing:** Cheerio

## Database Configuration

### Prisma Schema

The application uses Prisma ORM with SQLite for data persistence. The schema is defined in `prisma/schema.prisma`:

```prisma
// User model
model User {
  id        String   @id @default(cuid())
  name      String?
  email     String   @unique
  password  String
  courses   SelectedCourse[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// SelectedCourse model
model SelectedCourse {
  id          String   @id @default(cuid())
  userId      String
  courseClass String
  section     String
  instructor  String?
  daysTimes   String?
  room        String?
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Database Setup

1. Install Prisma CLI:
   ```bash
   npm install -g prisma
   ```

2. Initialize the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. For development, the database is stored in `prisma/dev.db`

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Optional: Google OAuth (if using Google authentication)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication routes
- `POST /api/register` - User registration

### Course Management
- `GET /api/courses` - Get user's saved courses
- `POST /api/courses` - Save user's courses
- `GET /api/requirements` - Get degree requirements
- `GET /api/sample-courses` - Get sample course data

## MySlice Integration

### Overview
The application integrates with Syracuse University's MySlice system to automatically import course history and academic records.

### Features
- **Course History Import:** Automatically fetches and parses course history
- **Microsoft Account Login:** Supports SU Microsoft account authentication
- **2FA Support:** Handles two-factor authentication
- **Session Management:** Maintains persistent sessions with cookies
- **Data Parsing:** Extracts detailed course information including:
  - Course code and title
  - Semester information
  - Grades and credits
  - Course status

### Environment Configuration

#### 1. Environment Variables
Create a `.env` file in the root directory with the following configuration:

```env
# Environment
NODE_ENV=development # Change to 'test' for testing mode

# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Optional: Google OAuth (if using Google authentication)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Chrome Configuration
CHROME_DEBUG_PORT=9222
CHROME_DEBUG_URL="http://localhost:9222"
```

#### 2. Test Environment (Sandbox Mode)
For testing and development purposes, use Chrome in debug mode:

```bash
# Set environment to test mode
export NODE_ENV=test

# Start Chrome in debug mode
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

Test environment features:
- Visual debugging
- Manual intervention capability
- Step-by-step process inspection
- Real-time browser interaction

#### 3. Production Environment
In production, the application creates new browser instances automatically:

```bash
# Set environment to production
export NODE_ENV=production

# Start the application
npm run dev
```

Production environment features:
- Headless browser operation
- Automatic browser instance management
- Optimized performance
- Resource-efficient operation

### Browser Configuration

#### Test Environment
```javascript
browser = await puppeteer.connect({
  browserURL: "http://localhost:9222",
  defaultViewport: null,
});
```

#### Production Environment
```javascript
browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu'
  ]
});
```

### Running the Application

1. **Test Mode**
   ```bash
   # Set test environment
   export NODE_ENV=test
   
   # Start Chrome in debug mode
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   
   # Run test scripts
   node test_login.js
   node get_courses.js
   ```

2. **Production Mode**
   ```bash
   # Set production environment
   export NODE_ENV=production
   
   # Start the application
   npm run dev
   ```

### Troubleshooting

#### Test Environment Issues
1. **Chrome Debug Connection**
   ```bash
   # Check if Chrome is running in debug mode
   lsof -i :9222
   
   # Kill existing Chrome processes if needed
   pkill -f "chrome.*remote-debugging-port"
   ```

2. **Connection Refused**
   - Ensure Chrome is running in debug mode
   - Verify the correct port is being used
   - Check for firewall restrictions

#### Production Environment Issues
1. **Browser Launch Failures**
   - Verify Chrome installation
   - Check system resources
   - Ensure proper permissions

2. **Memory Issues**
   - Monitor browser process memory usage
   - Implement proper cleanup in finally blocks
   - Use appropriate browser arguments

### Security Considerations

1. **Test Environment**
   - Keep debug port secure
   - Use localhost only
   - Implement proper error handling

2. **Production Environment**
   - Use headless mode
   - Implement proper sandboxing
   - Follow security best practices
   - Monitor resource usage

### API Endpoints

1. **Login to MySlice**
   ```javascript
   POST /api/myslice
   {
     "username": "your_netid@syr.edu",
     "password": "your_password"
   }
   ```

2. **Scrape Academic Record**
   ```javascript
   POST /api/scrape-academic-record
   {
     "username": "your_netid@syr.edu",
     "password": "your_password"
   }
   ```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- SQLite (for database)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/peterCheng123321/group15.git
   cd group15
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
npm run build
npm start
```

## Usage

1. **Course Search:** Use the search functionality to find courses by department, code, or instructor
2. **Calendar View:** Visualize your weekly schedule with color-coded course blocks
3. **Image Import:** Upload an image of your schedule to automatically extract course information
4. **Major Requirements:** View courses required for your major/degree program
5. **User Account:** Register and login to save your course selections
6. **Notifications:** Receive alerts about schedule conflicts and changes

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
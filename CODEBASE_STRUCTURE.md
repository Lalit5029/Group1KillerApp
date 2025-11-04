# Codebase Structure

This document outlines the organization of the codebase for easier navigation and development.

## Directory Structure

```
group15/
├── app/                    # Next.js application
│   ├── api/                # API routes
│   │   └── sample-courses/ # Sample course data API
│   ├── academic-progress/  # Academic progress page
│   ├── globals.css         # Global styles
│   └── layout.tsx          # Root layout
├── backend/                # Backend services
│   ├── src/
│   │   ├── api/            # API endpoints
│   │   ├── ml/             # Machine learning models and scripts
│   │   └── scrapers/       # Data scraping scripts
│   ├── data/               # Data storage
│   └── index.js            # Backend entry point
├── components/             # React components
│   └── ui/                 # UI components (buttons, cards, etc.)
├── lib/                    # Shared libraries
│   ├── courseRecommender.js # Course recommendation logic
│   ├── performancePredictor.js # Performance prediction model
│   └── academic-data.ts    # Academic data processing
├── public/                 # Static assets
│   ├── data/               # JSON and CSV data files
│   └── images/             # Image assets
├── styles/                 # CSS modules and theme files
├── scripts/                # Utility scripts
├── hooks/                  # Custom React hooks
└── package.json            # Project dependencies
```

## Main Components

### Frontend (Next.js Application)

The application is built with Next.js and uses a modern React architecture:

- `app/`: Contains the Next.js pages and API routes
- `components/`: Reusable React components
- `lib/`: Shared utilities and business logic
- `public/`: Static assets served by Next.js

### Backend Services

The backend is organized into several modules:

- `backend/src/api/`: API endpoints for data access
- `backend/src/ml/`: Machine learning models for performance prediction
- `backend/src/scrapers/`: Data collection scripts

### Data Flow

1. User academic data is collected through the academic record importer
2. The performance predictor uses ML models to predict course outcomes
3. The course recommender suggests optimal courses
4. The academic progress page displays all information to the user

## Development Guidelines

- Frontend components should be placed in the `components/` directory
- Shared logic should be in the `lib/` directory
- Backend services should be in the appropriate `backend/src/` subdirectory
- Data files should be in either `public/data/` or `backend/data/` depending on access patterns
- API routes should be in the `app/api/` directory

## Running the Application

- Frontend: `npm run dev`
- Backend API: `node backend/src/api/academic_scraper_api.js`
- ML Training: `node backend/src/ml/trainModels.js` 
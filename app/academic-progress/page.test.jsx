import { render, screen, waitFor, act } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import AcademicProgressPage from './page';

// Mock the useMemo hook
const mockUseMemo = jest.fn((fn) => fn());

jest.unstable_mockModule('react', () => ({
  ...jest.requireActual('react'),
  useMemo: mockUseMemo
}));

const sampleData = {
  courses: [
    { courseCode: 'CIS 341', courseName: 'Artificial Intelligence', grade: 'A', credits: 3, term: 'Fall 2023' },
    { courseCode: 'CIS 351', courseName: 'Data Structures', grade: 'B+', credits: 4, term: 'Spring 2024' }
  ],
  student: {
    name: 'John Doe',
    major: 'Computer Science',
    graduationYear: '2025',
    totalCredits: 7,
    gpa: 3.6
  },
  recommendedCourses: [
    { courseCode: 'CIS 400', courseName: 'Machine Learning', credits: 3, predictedGrade: 'A-' }
  ],
  futureRequirements: [
    { courseCode: 'CIS 486', courseName: 'Capstone Project', credits: 4, required: true }
  ]
};

const requirementsData = {
  totalCreditsRequired: 120,
  majorRequirements: [
    { courseCode: 'CIS 341', courseName: 'Artificial Intelligence', credits: 3, required: true },
    { courseCode: 'CIS 351', courseName: 'Data Structures', credits: 4, required: true }
  ]
};

describe('AcademicProgressPage', () => {
  beforeEach(() => {
    mockUseMemo.mockClear();
    global.fetch = jest.fn();
  });

  it('should display loading state initially', async () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));
    render(<AcademicProgressPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display empty state when no courses are loaded', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ courses: [], student: { totalCredits: 0, gpa: 0 }, recommendedCourses: [], futureRequirements: [] })
    });

    render(<AcademicProgressPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No courses found')).toBeInTheDocument();
    });
  });

  it('should display course data and statistics when loaded', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleData
    });

    render(<AcademicProgressPage />);
    
    await waitFor(() => {
      // Check for course information
      expect(screen.getByText('CIS 341')).toBeInTheDocument();
      expect(screen.getByText('CIS 351')).toBeInTheDocument();
      
      // Check for student statistics
      expect(screen.getByText('7')).toBeInTheDocument(); // Total credits
      expect(screen.getByText('3.6')).toBeInTheDocument(); // GPA
      
      // Check for recommended courses
      expect(screen.getByText('CIS 400')).toBeInTheDocument();
      expect(screen.getByText('A-')).toBeInTheDocument(); // Predicted grade
    });
  });

  it('should handle data import actions', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleData
    });

    render(<AcademicProgressPage />);
    
    await waitFor(() => {
      const importButton = screen.getByRole('button', { name: /Import from MySlice/i });
      expect(importButton).toBeInTheDocument();
      
      const sampleDataButton = screen.getByRole('button', { name: /Load Sample Data/i });
      expect(sampleDataButton).toBeInTheDocument();
    });
  });

  it('should display error state on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<AcademicProgressPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading data/i)).toBeInTheDocument();
    });
  });
}); 
import { describe, it, expect } from '@jest/globals';
import { CourseData } from './types';
import { calculateTotalCredits, generateAcademicSummary } from './academic-data';

describe('Academic Data Utilities', () => {
  const sampleCourses: CourseData[] = [
    {
      code: 'CSE101',
      name: 'Introduction to Computer Science',
      term: 'Fall 2023',
      credits: '3',
      grade: 'A',
      requirementGroup: 'Major Requirements'
    },
    {
      code: 'MAT101',
      name: 'Calculus I',
      term: 'Fall 2023',
      credits: '4',
      grade: 'B+',
      requirementGroup: 'Math Requirements'
    },
    {
      code: 'ENG101',
      name: 'English Composition',
      term: 'Spring 2024',
      credits: '3',
      grade: 'IP',
      requirementGroup: 'General Education'
    },
    {
      code: 'PHY101',
      name: 'Physics I',
      term: 'Spring 2024',
      credits: '4',
      grade: 'WD',
      requirementGroup: 'Science Requirements'
    }
  ];

  describe('calculateTotalCredits', () => {
    it('should calculate total credits excluding withdrawn and in-progress courses', () => {
      const totalCredits = calculateTotalCredits(sampleCourses);
      expect(totalCredits).toBe(7); // 3 + 4 (excluding IP and WD courses)
    });

    it('should return 0 for empty course list', () => {
      const totalCredits = calculateTotalCredits([]);
      expect(totalCredits).toBe(0);
    });

    it('should handle courses with invalid credit values', () => {
      const coursesWithInvalidCredits: CourseData[] = [
        {
          code: 'CSE101',
          name: 'Introduction to Computer Science',
          term: 'Fall 2023',
          credits: '3',
          grade: 'A'
        },
        {
          code: 'BIO101',
          name: 'Biology I',
          term: 'Spring 2024',
          credits: '',
          grade: 'A'
        }
      ];
      const totalCredits = calculateTotalCredits(coursesWithInvalidCredits);
      expect(totalCredits).toBe(3); // Should only count valid credit values
    });
  });

  describe('generateAcademicSummary', () => {
    it('should generate correct academic summary', () => {
      const summary = generateAcademicSummary(sampleCourses);

      expect(summary.totalCourses).toBe(4);
      expect(summary.completedCourses).toBe(2);
      expect(summary.inProgressCourses).toBe(1);
      expect(summary.withdrawnCourses).toBe(1);
      expect(summary.totalCredits).toBe(7);
      expect(summary.gpa).toBeDefined();

      // Check requirement progress
      expect(summary.requirementProgress['Major Requirements'].completed).toBe(3);
      expect(summary.requirementProgress['Math Requirements'].completed).toBe(4);
      expect(summary.requirementProgress['General Education'].completed).toBe(0);
      expect(summary.requirementProgress['Science Requirements'].completed).toBe(0);
    });

    it('should handle courses without requirement groups', () => {
      const coursesWithoutGroups = [
        {
          code: 'CSE101',
          name: 'Introduction to Computer Science',
          term: 'Fall 2023',
          credits: '3',
          grade: 'A'
        }
      ];

      const summary = generateAcademicSummary(coursesWithoutGroups);
      expect(summary.requirementProgress['Other'].completed).toBe(3);
    });

    it('should handle empty course list', () => {
      const summary = generateAcademicSummary([]);
      expect(summary.totalCourses).toBe(0);
      expect(summary.completedCourses).toBe(0);
      expect(summary.inProgressCourses).toBe(0);
      expect(summary.withdrawnCourses).toBe(0);
      expect(summary.totalCredits).toBe(0);
      expect(summary.gpa).toBe('0.00');
      expect(Object.keys(summary.requirementProgress)).toHaveLength(0);
    });
  });
}); 
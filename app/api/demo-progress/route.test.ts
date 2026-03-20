import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { GET } from "./route";

const mockFindUnique = jest.fn<() => Promise<unknown>>();
const mockFindFirst = jest.fn<() => Promise<unknown>>();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    student: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

describe("GET /api/demo-progress", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
  });

  it("returns 404 when demo advisor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("Demo advisor not found");
    expect(data.error).toContain("db:seed");
  });

  it("returns 200 with advisor, student, totalCredits, academicCourses, degreeRequirements when data exists", async () => {
    const mockAdvisor = {
      name: "Demo Advisor",
      email: "demo@group1.local",
    };
    const mockStudent = {
      id: "student-1",
      name: "Alex Johnson",
      externalStudentId: "900123456",
      academicCourses: [
        { id: "1", code: "CIS 275", name: "Software Design", term: "Fall 2024", credits: "3" },
      ],
      degreeRequirements: [
        { id: "1", title: "Core", status: "In Progress", courses: ["CIS 275"] },
      ],
    };
    mockFindUnique.mockResolvedValue(mockAdvisor);
    mockFindFirst.mockResolvedValue(mockStudent);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({ name: "Demo Advisor", email: "demo@group1.local" });
    expect(data.student).toEqual({
      id: "student-1",
      name: "Alex Johnson",
      externalStudentId: "900123456",
    });
    expect(data.totalCredits).toBe(3);
    expect(data.academicCourses).toHaveLength(1);
    expect(data.degreeRequirements).toHaveLength(1);
  });

  it("calculates totalCredits from academic courses", async () => {
    mockFindUnique.mockResolvedValue({
      name: "Demo",
      email: "demo@group1.local",
    });
    mockFindFirst.mockResolvedValue({
      id: "student-1",
      name: "Alex Johnson",
      externalStudentId: "900123456",
      academicCourses: [
        { id: "1", code: "A", name: "Course A", term: "Fall", credits: "4" },
        { id: "2", code: "B", name: "Course B", term: "Spring", credits: "3" },
      ],
      degreeRequirements: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalCredits).toBe(7);
  });
});

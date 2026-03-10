import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { GET } from "./route";

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
}));

describe("GET /api/requirements", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("returns transformed scheduler-style requirements when file exists and has valid data", async () => {
    mockExistsSync.mockReturnValue(true);
    const mockData = [
      {
        program: "Computer Science",
        categories: {
          "First Year, Fall Semester": [{ code: "CIS 252", name: "Intro to CS" }],
          "Upper Division Elective": [{ code: "CIS 375", name: "Security" }],
        },
      },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);

    const majorKey = "Computer Science, BS";
    expect(data[majorKey]).toBeDefined();

    const major = data[majorKey];
    expect(Array.isArray(major.Freshman)).toBe(true);
    expect(Array.isArray(major.Sophomore)).toBe(true);
    expect(Array.isArray(major.Junior)).toBe(true);
    expect(Array.isArray(major.Senior)).toBe(true);

    // First-year category goes to Freshman, non-year category is added to all years
    expect(major.Freshman).toEqual(expect.arrayContaining(["CIS 252", "CIS 375"]));
    expect(major.Sophomore).toEqual(expect.arrayContaining(["CIS 375"]));
    expect(major.Junior).toEqual(expect.arrayContaining(["CIS 375"]));
    expect(major.Senior).toEqual(expect.arrayContaining(["CIS 375"]));
  });

  it("returns 404 with scraper hint when requirements file is missing", async () => {
    mockExistsSync.mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("Requirements data file not found");
    expect(data.error).toContain("Run the scraper");
  });

  it("returns 500 when requirements file has invalid shape (not an array)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ program: "Not an array root" }));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Invalid requirements data format");
  });
});


import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { fetchRequirements } from "./data-utils";

describe("fetchRequirements", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    (global as any).fetch = mockFetch;
  });

  it("returns data from /api/requirements when API responds OK", async () => {
    const apiData = { "CompEng, BS": { Freshman: ["ECS 101"] } };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiData,
    } as any);

    const result = await fetchRequirements();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/requirements");
    expect(result).toEqual(apiData);
  });

  it("falls back to static JSON when /api/requirements is not OK", async () => {
    const staticData = { "CIS, BS": { Freshman: ["CIS 252"] } };

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => staticData,
      } as any);

    const result = await fetchRequirements();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/requirements");
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/data/engineering_majors_requirements.json");
    expect(result).toEqual(staticData);
  });

  it("returns empty object when both API and static JSON fail", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

    const result = await fetchRequirements();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({});
  });
});


import type { Course, SelectedCourse } from "@/lib/types";
import {
  inferCatalogTermBucket,
  isLikelyOnlineDeliverySection,
  resolveCatalogTermPreference,
  sortSectionsForAutoSchedule,
} from "@/lib/schedule-section-prefs";

describe("schedule-section-prefs", () => {
  it("infers fall and spring from meeting dates", () => {
    expect(inferCatalogTermBucket("08/24/2026 - 12/07/2026")).toBe("fall");
    expect(inferCatalogTermBucket("01/12/2026 - 04/27/2026")).toBe("spring");
    expect(inferCatalogTermBucket("TBA")).toBe("unknown");
  });

  it("resolveCatalogTermPreference prefers fall when any fall section exists", () => {
    const mixed: Course[] = [
      { Class: "WRT 105", Section: "A", MeetingDates: "01/12/2026 - 04/27/2026" },
      { Class: "WRT 105", Section: "B", MeetingDates: "08/24/2026 - 12/07/2026" },
    ];
    expect(resolveCatalogTermPreference(mixed)).toBe("fall");
  });

  it("resolveCatalogTermPreference uses spring only when no fall exists", () => {
    const springOnly: Course[] = [
      { Class: "WRT 105", Section: "A", MeetingDates: "01/12/2026 - 04/27/2026" },
      { Class: "WRT 105", Section: "B", MeetingDates: "01/13/2026 - 04/23/2026" },
    ];
    expect(resolveCatalogTermPreference(springOnly)).toBe("spring");
  });

  it("prefers listed catalog id for PHI 451 when present", () => {
    const other: Course = {
      id: "course-x",
      Class: "PHI 451",
      Section: "M099",
      DaysTimes: "MoWe 8:00AM - 9:20AM",
      MeetingDates: "08/25/2026 - 12/08/2026",
    };
    const preferred: Course = {
      id: "course-2439",
      Class: "PHI 451",
      Section: "M001",
      DaysTimes: "TuTh 9:30AM - 10:50AM",
      MeetingDates: "08/25/2026 - 12/08/2026",
    };
    const ordered = sortSectionsForAutoSchedule({
      sections: [other, preferred],
      normalizedCode: "PHI 451",
      selected: [],
    });
    expect(ordered[0]).toBe(preferred);
  });

  it("deprioritizes likely-online delivery when sorting", () => {
    const online: Course = {
      id: "o1",
      Class: "ECN 101",
      Section: "M1",
      DaysTimes: "Mo 10:00AM - 11:00AM",
      Room: "ONLINE SYNCHRONOUS",
      MeetingDates: "08/24/2026 - 12/07/2026",
    };
    const inPerson: Course = {
      id: "p1",
      Class: "ECN 101",
      Section: "M2",
      DaysTimes: "TuTh 2:00PM - 3:20PM",
      Room: "Eggers Hall 018",
      MeetingDates: "08/25/2026 - 12/08/2026",
    };
    expect(isLikelyOnlineDeliverySection(online)).toBe(true);
    expect(isLikelyOnlineDeliverySection(inPerson)).toBe(false);
    const ordered = sortSectionsForAutoSchedule({
      sections: [online, inPerson],
      normalizedCode: "ECN 101",
      selected: [],
    });
    expect(ordered[0]).toBe(inPerson);
  });

  it("sortSectionsForAutoSchedule ranks fall before spring when both exist", () => {
    const spring: Course = {
      id: "c1",
      Class: "WRT 105",
      Section: "S1",
      DaysTimes: "Mo 9:30AM - 10:25AM",
      MeetingDates: "01/12/2026 - 04/27/2026",
    };
    const fall: Course = {
      id: "c2",
      Class: "WRT 105",
      Section: "F1",
      DaysTimes: "TuTh 2:00PM - 3:20PM",
      MeetingDates: "08/25/2026 - 12/08/2026",
    };
    const ordered = sortSectionsForAutoSchedule({
      sections: [spring, fall],
      normalizedCode: "WRT 105",
      selected: [],
    });
    expect(ordered[0]).toBe(fall);
  });

  it("prefers ECS 392 Pierce main sections over FlexLong when ids match", () => {
    const flex: Course = {
      id: "course-x",
      Class: "ECS 392",
      Section: "M021-SEC FlexLong",
      DaysTimes: "MoWe 2:15PM - 3:10PM",
      MeetingDates: "01/26/2026 - 04/27/2026",
    };
    const preferred: Course = {
      id: "course-644",
      Class: "ECS 392",
      Section: "M002",
      DaysTimes: "MoWeFr 10:35AM - 11:30AM",
      MeetingDates: "08/24/2026 - 12/07/2026",
    };
    const ordered = sortSectionsForAutoSchedule({
      sections: [flex, preferred],
      normalizedCode: "ECS 392",
      selected: [],
    });
    expect(ordered[0]).toBe(preferred);
  });

  it("ranks non-conflicting sections before conflicting ones", () => {
    const selected: SelectedCourse[] = [
      {
        id: "s1",
        Class: "CIS 321",
        Section: "A",
        DaysTimes: "TuTh 2:00PM - 3:20PM",
      },
    ];
    const clash: Course = {
      id: "b1",
      Class: "CSE 384",
      Section: "X",
      DaysTimes: "TuTh 2:30PM - 3:45PM",
      MeetingDates: "01/12/2026 - 04/27/2026",
    };
    const ok: Course = {
      id: "b2",
      Class: "CSE 384",
      Section: "Y",
      DaysTimes: "MoWeFr 9:30AM - 10:25AM",
      MeetingDates: "01/12/2026 - 04/27/2026",
    };
    const ordered = sortSectionsForAutoSchedule({
      sections: [clash, ok],
      normalizedCode: "CSE 384",
      selected,
    });
    expect(ordered[0]).toBe(ok);
  });
});

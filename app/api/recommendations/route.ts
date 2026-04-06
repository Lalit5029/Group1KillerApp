import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";
import { buildPyReasonPayload } from "@/lib/recommendation/build-pyreason-payload";
import { runFallbackReasoner } from "@/lib/recommendation/fallback-reasoner";
import { rankRecommendations } from "@/lib/recommendation/rank-recommendations";
import { runPyReason } from "@/lib/recommendation/run-pyreason";
import type {
  CatalogSectionRecord,
  RecommendationApiResponse,
  RequirementBlockRecord,
} from "@/lib/recommendation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const body = await request.json();

    const studentId = String(body.studentId || "");
    const selectedMajor = String(body.selectedMajor || "").trim();
    const selectedYear = String(body.selectedYear || "").trim();
    const term = String(body.term || "Current Catalog");
    const requirementsForMajor = body.requirementsForMajor || {};
    const catalogCourses = Array.isArray(body.catalogCourses)
      ? (body.catalogCourses as CatalogSectionRecord[])
      : [];

    const student = await getAuthorizedStudent(studentId, session.user.id);

    const [academicCourses, degreeRequirements] = await Promise.all([
      prisma.academicCourse.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.degreeRequirement.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const payload = buildPyReasonPayload({
      studentId: student.id,
      studentName: student.name,
      selectedMajor: selectedMajor || student.major || "",
      selectedYear: selectedYear || student.academicYear || "",
      term,
      requirementsForMajor,
      academicCourses,
      degreeRequirements: degreeRequirements.map((block) => ({
        title: block.title,
        status: block.status,
        courses: Array.isArray(block.courses)
          ? (block.courses as unknown as RequirementBlockRecord["courses"])
          : [],
      })),
      catalogCourses,
    });

    let engine: "pyreason" | "fallback" = "pyreason";
    let inferredResults;

    try {
      const pyreasonResponse = await runPyReason(payload);
      const hasAnySignal = pyreasonResponse.results.some((result) =>
        Object.values(result.flags).some(Boolean)
      );

      // Some local PyReason builds successfully execute but do not emit any
      // inferred labels because of version-specific rule/trace behavior. In
      // that case, fall back to the deterministic mirror instead of returning
      // misleading empty inferences to the ranking layer.
      if (!hasAnySignal && payload.candidateCourses.length > 0) {
        console.warn(
          "PyReason returned no inferred labels. Raw trace:\n",
          JSON.stringify(pyreasonResponse.rawTrace, null, 2)
        );
        throw new Error("PyReason returned no inferred labels");
      }

      inferredResults = pyreasonResponse.results;
    } catch (error) {
      console.warn("PyReason unavailable, falling back to deterministic reasoner:", error);
      engine = "fallback";
      inferredResults = runFallbackReasoner(payload);
    }

    const ranked = rankRecommendations(payload.candidateCourses, inferredResults);

    const response: RecommendationApiResponse = {
      recommendedCourses: ranked.filter((item) => !item.blocked),
      blockedCourses: ranked.filter((item) => item.blocked),
      debug: {
        engine,
        candidateCount: payload.candidateCourses.length,
        term,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate recommendations";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

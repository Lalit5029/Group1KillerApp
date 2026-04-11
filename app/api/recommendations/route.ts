import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";
import { buildRecommendationPayload } from "@/lib/recommendation/build-recommendation-payload";
import { runFallbackReasoner } from "@/lib/recommendation/fallback-reasoner";
import { rankRecommendations } from "@/lib/recommendation/rank-recommendations";
import { loadComputerScienceProgramRules } from "@/lib/program-rules/load-program-rules";
import type {
  CatalogSectionRecord,
  RecommendationApiResponse,
  RequirementBlockRecord,
} from "@/lib/recommendation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CS_MAJOR_KEY = "Computer Science, BS";

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

    const resolvedMajor = selectedMajor || student.major || "";
    const programRules =
      resolvedMajor === DEFAULT_CS_MAJOR_KEY ? loadComputerScienceProgramRules() : null;

    const payload = buildRecommendationPayload({
      studentId: student.id,
      studentName: student.name,
      selectedMajor: resolvedMajor,
      selectedYear: selectedYear || student.academicYear || "",
      term,
      requirementsForMajor,
      programRules,
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

    const engine: "fallback" = "fallback";
    const inferredResults = runFallbackReasoner(payload);

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

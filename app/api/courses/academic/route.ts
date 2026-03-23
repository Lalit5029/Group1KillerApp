import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";

function dedupeAcademicCourses(courses: any[]) {
  const seen = new Set<string>();

  return courses.filter((course) => {
    const dedupeKey = [
      course.code,
      course.term,
      course.name || course.title,
      course.grade,
      course.credits,
    ]
      .map((value) => String(value || "").trim().toUpperCase())
      .join("::");

    if (seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
}

// GET /api/courses/academic - Get user's saved academic courses
export async function GET(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const student = await getAuthorizedStudent(studentId, session.user.id);

    const academicCourses = await prisma.academicCourse.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(dedupeAcademicCourses(academicCourses));
  } catch (error) {
    console.error("Error fetching academic courses:", error);
    const message =
      error instanceof Error ? error.message : "Error fetching academic courses";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { message },
      { status }
    );
  }
}

// POST /api/courses/academic - Save user's academic courses
export async function POST(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const courses = dedupeAcademicCourses(await request.json());
    const student = await getAuthorizedStudent(studentId, session.user.id);

    // Delete existing academic courses
    await prisma.academicCourse.deleteMany({
      where: { studentId: student.id },
    });

    if (!Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json({
        message: "Academic courses cleared successfully",
      });
    }

    // Add new academic courses
    await prisma.academicCourse.createMany({
      data: courses.map((course: any) => ({
        studentId: student.id,
        code: course.code,
        name: course.name,
        term: course.term,
        grade: course.grade,
        credits: course.credits,
        requirementGroup: course.requirementGroup,
        course: course.code,
        title: course.name || course.code,
        catalogGroup: course.catalogGroup,
        isRecommended: course.isRecommended || false,
        isFuture: course.isFuture || false,
      })),
    });

    return NextResponse.json({
      message: "Academic courses saved successfully",
    });
  } catch (error) {
    console.error("Error saving academic courses:", error);
    const message =
      error instanceof Error ? error.message : "Error saving academic courses";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { message },
      { status }
    );
  }
}

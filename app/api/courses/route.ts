import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";

// GET /api/courses - Get user's saved courses
export async function GET(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const student = await getAuthorizedStudent(studentId, session.user.id);

    const courses = await prisma.selectedCourse.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    const message = error instanceof Error ? error.message : "Error fetching courses";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { message },
      { status }
    );
  }
}

// POST /api/courses - Save user's courses
export async function POST(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const courses = await request.json();
    const student = await getAuthorizedStudent(studentId, session.user.id);

    // Delete existing courses
    await prisma.selectedCourse.deleteMany({
      where: { studentId: student.id },
    });

    // Add new courses
    await prisma.selectedCourse.createMany({
      data: courses.map((course: any) => ({
        studentId: student.id,
        courseClass: course.Class,
        section: course.Section,
        instructor: course.Instructor || "",
        daysTimes: course.DaysTimes || "",
        room: course.Room || "",
      })),
    });

    return NextResponse.json({ message: "Courses saved successfully" });
  } catch (error) {
    console.error("Error saving courses:", error);
    const message = error instanceof Error ? error.message : "Error saving courses";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { message },
      { status }
    );
  }
}

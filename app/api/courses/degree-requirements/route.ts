import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const student = await getAuthorizedStudent(studentId, session.user.id);

    const degreeRequirements = await prisma.degreeRequirement.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(degreeRequirements);
  } catch (error) {
    console.error("Error fetching degree requirements:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch degree requirements";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const studentId = new URL(request.url).searchParams.get("studentId");
    const student = await getAuthorizedStudent(studentId, session.user.id);
    const data = await request.json();

    // Delete existing degree requirements
    await prisma.degreeRequirement.deleteMany({
      where: { studentId: student.id },
    });

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ message: "Degree requirements cleared successfully" });
    }

    // Create new degree requirements
    const degreeRequirements = await prisma.degreeRequirement.createMany({
      data: data.map((block: any) => ({
        studentId: student.id,
        title: block.title,
        status: block.status,
        courses: block.courses,
      })),
    });

    return NextResponse.json(degreeRequirements);
  } catch (error) {
    console.error("Error saving degree requirements:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save degree requirements";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

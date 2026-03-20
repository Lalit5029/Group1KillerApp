import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/demo-progress
 * Returns the demo user's academic courses and degree requirements from MongoDB.
 * No auth required — for Week 1 "proof that data is in the DB" demo.
 */
export async function GET() {
  try {
    const demoAdvisor = await prisma.user.findUnique({
      where: { email: "demo@group1.local" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!demoAdvisor) {
      return NextResponse.json(
        { error: "Demo advisor not found. Run: npm run db:seed" },
        { status: 404 }
      );
    }

    const demoStudent = await prisma.student.findFirst({
      where: { advisorId: demoAdvisor.id },
      include: {
        academicCourses: true,
        degreeRequirements: true,
      },
    });

    if (!demoStudent) {
      return NextResponse.json(
        { error: "Demo student not found. Run: npm run db:seed" },
        { status: 404 }
      );
    }

    const totalCredits = demoStudent.academicCourses.reduce(
      (sum, c) => sum + (parseFloat(c.credits) || 0),
      0
    );

    return NextResponse.json({
      user: { name: demoAdvisor.name, email: demoAdvisor.email },
      student: {
        id: demoStudent.id,
        name: demoStudent.name,
        externalStudentId: demoStudent.externalStudentId,
      },
      totalCredits,
      academicCourses: demoStudent.academicCourses,
      degreeRequirements: demoStudent.degreeRequirements,
    });
  } catch (error) {
    console.error("Error fetching demo progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch demo progress" },
      { status: 500 }
    );
  }
}

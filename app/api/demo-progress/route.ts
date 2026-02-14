import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/demo-progress
 * Returns the demo user's academic courses and degree requirements from MongoDB.
 * No auth required — for Week 1 "proof that data is in the DB" demo.
 */
export async function GET() {
  try {
    const demoUser = await prisma.user.findUnique({
      where: { email: "demo@group1.local" },
      include: {
        academicCourses: true,
        degreeRequirements: true,
      },
    });

    if (!demoUser) {
      return NextResponse.json(
        { error: "Demo user not found. Run: npm run db:seed" },
        { status: 404 }
      );
    }

    const totalCredits = demoUser.academicCourses.reduce(
      (sum, c) => sum + (parseFloat(c.credits) || 0),
      0
    );

    return NextResponse.json({
      user: { name: demoUser.name, email: demoUser.email },
      totalCredits,
      academicCourses: demoUser.academicCourses,
      degreeRequirements: demoUser.degreeRequirements,
    });
  } catch (error) {
    console.error("Error fetching demo progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch demo progress" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";

// GET /api/courses/academic - Get user's saved academic courses
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { academicCourses: true },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user.academicCourses);
  } catch (error) {
    console.error("Error fetching academic courses:", error);
    return NextResponse.json(
      { message: "Error fetching academic courses" },
      { status: 500 }
    );
  }
}

// POST /api/courses/academic - Save user's academic courses
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const courses = await request.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Delete existing academic courses
    await prisma.academicCourse.deleteMany({
      where: { userId: user.id },
    });

    // Add new academic courses
    await prisma.academicCourse.createMany({
      data: courses.map((course: any) => ({
        userId: user.id,
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
    return NextResponse.json(
      { message: "Error saving academic courses" },
      { status: 500 }
    );
  }
}

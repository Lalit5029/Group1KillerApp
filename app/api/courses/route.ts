import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";

// GET /api/courses - Get user's saved courses
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { courses: true },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user.courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { message: "Error fetching courses" },
      { status: 500 }
    );
  }
}

// POST /api/courses - Save user's courses
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

    // Delete existing courses
    await prisma.selectedCourse.deleteMany({
      where: { userId: user.id },
    });

    // Add new courses
    await prisma.selectedCourse.createMany({
      data: courses.map((course: any) => ({
        userId: user.id,
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
    return NextResponse.json(
      { message: "Error saving courses" },
      { status: 500 }
    );
  }
}

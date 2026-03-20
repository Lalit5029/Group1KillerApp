import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdvisorSession } from "@/lib/server-auth";

export async function GET() {
  try {
    const session = await requireAdvisorSession();

    const students = await prisma.student.findMany({
      where: { advisorId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(students);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load students";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdvisorSession();
    const body = await request.json();

    const name = String(body.name || "").trim();
    const externalStudentId = String(body.externalStudentId || "").trim() || null;
    const email = String(body.email || "").trim() || null;
    const major = String(body.major || "").trim() || null;
    const academicYear = String(body.academicYear || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;

    if (!name) {
      return NextResponse.json(
        { message: "Student name is required" },
        { status: 400 }
      );
    }

    if (externalStudentId) {
      const existingStudent = await prisma.student.findFirst({
        where: {
          advisorId: session.user.id,
          externalStudentId,
        },
      });

      if (existingStudent) {
        return NextResponse.json(
          { message: "A student with that ID already exists in your roster" },
          { status: 409 }
        );
      }
    }

    const student = await prisma.student.create({
      data: {
        advisorId: session.user.id,
        name,
        externalStudentId,
        email,
        major,
        academicYear,
        notes,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create student";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("Unique constraint")
        ? 409
        : 500;
    return NextResponse.json({ message }, { status });
  }
}

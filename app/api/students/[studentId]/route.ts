import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth";

type Params = { params: Promise<{ studentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAdvisorSession();
    const { studentId } = await params;
    const student = await getAuthorizedStudent(studentId, session.user.id);
    return NextResponse.json(student);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load student";
    const status =
      message === "Unauthorized" ? 401 : message === "Student not found" ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdvisorSession();
    const { studentId } = await params;
    await getAuthorizedStudent(studentId, session.user.id);

    await prisma.student.delete({
      where: { id: studentId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove student";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Student not found"
          ? 404
          : 500;
    return NextResponse.json({ message }, { status });
  }
}

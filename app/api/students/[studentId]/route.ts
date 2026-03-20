import { NextResponse } from "next/server";
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

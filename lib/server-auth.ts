import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type AdvisorSession = {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: "ADVISOR" | "ADMIN";
  };
};

export async function requireAdvisorSession(): Promise<AdvisorSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) {
    throw new Error("Unauthorized");
  }
  return session as AdvisorSession;
}

export async function getAuthorizedStudent(
  studentId: string | null | undefined,
  advisorId: string
) {
  if (!studentId) {
    throw new Error("Student selection is required");
  }

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      advisorId,
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  return student;
}

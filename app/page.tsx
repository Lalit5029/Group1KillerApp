"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import CourseScheduler from "@/components/course-scheduler";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const studentId = searchParams.get("studentId");
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!studentId) {
      router.replace("/students");
      return;
    }

    const loadStudent = async () => {
      setIsLoadingStudent(true);
      setError(null);
      try {
        const response = await fetch(`/api/students/${studentId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load student");
        }
        setStudent(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load student");
      } finally {
        setIsLoadingStudent(false);
      }
    };

    loadStudent();
  }, [router, status, studentId]);

  if (status === "loading" || isLoadingStudent) {
    return <main className="min-h-screen p-8 text-sm text-slate-600">Loading advisor workspace...</main>;
  }

  if (!studentId) {
    return null;
  }

  if (error || !student) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Unable to open student workspace</h1>
          <p className="mt-2 text-sm text-slate-600">{error || "Student not found."}</p>
          <div className="mt-4 flex gap-3">
            <Button asChild>
              <Link href="/students">Back to student list</Link>
            </Button>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
              Log out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <nav className="mb-8 rounded-lg bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Advisor Course Planner</h1>
            <p className="text-xs text-slate-500">
              Working on {student.name}
              {student.externalStudentId ? ` • ${student.externalStudentId}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">
                {session?.user?.name || "Advisor"}
              </div>
              <div className="text-xs text-slate-500">{session?.user?.email}</div>
            </div>
            <Button asChild variant="outline">
              <Link href="/students">Switch student</Link>
            </Button>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
              Log out
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl">
        <CourseScheduler selectedStudentId={student.id} selectedStudentName={student.name} />
      </div>
    </main>
  );
}

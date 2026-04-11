"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import CourseScheduler from "@/components/course-scheduler";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import type { Student } from "@/lib/types";

function HomePageContent() {
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
    return (
      <main className="min-h-screen bg-background p-8 text-sm text-muted-foreground">
        Loading advisor workspace…
      </main>
    );
  }

  if (!studentId) {
    return null;
  }

  if (error || !student) {
    return (
      <main className="min-h-screen bg-muted/30 p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Unable to open student workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || "Student not found."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/students">Back to student list</Link>
            </Button>
            <Button
              className="bg-primary-700 hover:bg-primary-800 text-white"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Log out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const subtitle = [
    student.name,
    student.externalStudentId ? `SUID ${student.externalStudentId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-muted/25">
      <SiteHeader
        title="Course Planner"
        subtitle={subtitle}
      >
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium text-foreground">
            {session?.user?.name || "Advisor"}
          </div>
          <div className="max-w-[200px] truncate text-xs text-muted-foreground">
            {session?.user?.email}
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="hidden sm:inline-flex bg-primary-700 hover:bg-primary-800 text-white"
        >
          <Link href="/students">Switch student</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="sm:hidden bg-primary-700 hover:bg-primary-800 text-white"
        >
          <Link href="/students">Students</Link>
        </Button>
        <Button
          size="sm"
          className="bg-primary-700 hover:bg-primary-800 text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Log out
        </Button>
      </SiteHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 rounded-lg border border-border/60 bg-card/80 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Academic planning workspace
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Schedule courses, review degree requirements, and import academic records
            </p>
          </div>
        </div>
        <CourseScheduler
          selectedStudentId={student.id}
          selectedStudentName={student.name}
          studentAcademicYear={student.academicYear}
        />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-8 text-sm text-muted-foreground">
          Loading advisor workspace…
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Student } from "@/lib/types";

const EMPTY_FORM = {
  name: "",
  externalStudentId: "",
  email: "",
  major: "",
  academicYear: "",
};

export default function StudentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/students");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load students");
      }
      setStudents(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleCreateStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create student");
      }

      setForm(EMPTY_FORM);
      setStudents((current) => [...current, data]);
      router.push(`/?studentId=${data.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create student");
    } finally {
      setIsCreating(false);
    }
  };

  const openStudentWorkspace = (studentId: string) => {
    router.push(`/?studentId=${studentId}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Advisor Workspace</h1>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as {session?.user?.name || session?.user?.email}. Pick a student to advise or create a new one.
            </p>
          </div>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
            Log out
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Your Students</CardTitle>
              <CardDescription>
                Select a student to open scheduling, recommendations, and academic imports for that record.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-slate-500">Loading students...</p>
              ) : students.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-slate-500">
                  No students yet. Create the first student record to begin advising.
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => openStudentWorkspace(student.id)}
                      className="w-full rounded-lg border bg-white p-4 text-left transition hover:border-slate-400 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-slate-900">{student.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {[student.externalStudentId, student.major, student.academicYear]
                              .filter(Boolean)
                              .join(" • ") || "No metadata yet"}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">Open</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Student</CardTitle>
              <CardDescription>
                Create a student record that will own imported academic data, saved schedules, and requirements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateStudent}>
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="externalStudentId">Student ID / SUID</Label>
                  <Input
                    id="externalStudentId"
                    value={form.externalStudentId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, externalStudentId: event.target.value }))
                    }
                    placeholder="900123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Student Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="student@syr.edu"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      value={form.major}
                      onChange={(event) => setForm((current) => ({ ...current, major: event.target.value }))}
                      placeholder="Computer Science, BS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academicYear">Academic Year</Label>
                    <Input
                      id="academicYear"
                      value={form.academicYear}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, academicYear: event.target.value }))
                      }
                      placeholder="Junior"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? "Creating student..." : "Create Student"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Student } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  externalStudentId: "",
  email: "",
  major: "Computer Science, BS",
  academicYear: "",
};

export default function StudentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/students");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load students");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create student");
      setForm(EMPTY_FORM);
      setStudents((current) => [...current, data]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      router.push(`/?studentId=${data.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create student");
    } finally {
      setIsCreating(false);
    }
  };

  const openStudentWorkspace = (id: string) => {
    router.push(`/?studentId=${id}`);
  };

  const confirmRemoveStudent = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${deletingStudent.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to remove student");
      }
      setStudents((current) => current.filter((s) => s.id !== deletingStudent.id));
      setDeletingStudent(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove student");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader
        title="Advisor workspace"
        subtitle="Syracuse University • Student records & scheduling"
      >
        <span className="hidden max-w-[200px] truncate text-right text-sm text-muted-foreground sm:block">
          {session?.user?.name || session?.user?.email}
        </span>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Log out
        </Button>
      </SiteHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your advisees
          </h2>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Select a student to open scheduling, degree requirements, and MySlice imports—or create
            a new record.
          </p>
        </div>

        {error && (
          <div
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="mb-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
            role="status"
          >
            Student created successfully.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="border-border/80 shadow-md lg:col-span-7">
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <CardDescription>
                Open a student workspace or remove a record. Removing a student deletes their
                saved schedules and imported data for this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading students…
                </div>
              ) : students.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-sm text-muted-foreground">
                  No students yet. Create a record using the form to begin advising.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {students.map((student) => (
                    <li key={student.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => openStudentWorkspace(student.id)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left transition",
                          "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{student.name}</div>
                          <div className="mt-0.5 truncate text-sm text-muted-foreground">
                            {[student.externalStudentId, student.major, student.academicYear]
                              .filter(Boolean)
                              .join(" · ") || "No metadata yet"}
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-auto min-h-[3.5rem] shrink-0 border-destructive/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${student.name}`}
                        onClick={() => setDeletingStudent(student)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md lg:col-span-5">
            <CardHeader>
              <CardTitle>Add student</CardTitle>
              <CardDescription>
                New records own schedules, imports, and requirements in this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student name</Label>
                  <Input
                    id="name"
                    placeholder="Jane Smith"
                    required
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="externalStudentId">SUID</Label>
                  <Input
                    id="externalStudentId"
                    placeholder="900123456"
                    value={form.externalStudentId}
                    onChange={(e) => setForm((c) => ({ ...c, externalStudentId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Student email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@syr.edu"
                    value={form.email}
                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      placeholder="Computer Science, BS"
                      value={form.major}
                      onChange={(e) => setForm((c) => ({ ...c, major: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academicYear">Year</Label>
                    <Input
                      id="academicYear"
                      placeholder="Junior"
                      value={form.academicYear}
                      onChange={(e) => setForm((c) => ({ ...c, academicYear: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isCreating} size="lg">
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create student"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={!!deletingStudent}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingStudent(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this student?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStudent ? (
                <>
                  <span className="font-medium text-foreground">{deletingStudent.name}</span> will be
                  removed from your roster. Their saved schedule, academic imports, and degree
                  requirement data stored for this app will be permanently deleted.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={confirmRemoveStudent}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove student"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

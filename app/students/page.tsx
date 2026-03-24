"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Student } from "@/lib/types";

const ORANGE = "#F85C00";
const NAVY = "#001a3d";

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
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const openStudentWorkspace = (studentId: string) => {
    router.push(`/?studentId=${studentId}`);
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    marginBottom: 6,
    display: "block",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(248,92,0,0.22)",
    borderRadius: 18,
    padding: 28,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: NAVY,
        fontFamily: "'Segoe UI', sans-serif",
        color: "#fff",
      }}
    >
      {/* Navbar */}
      <nav
        style={{
          background: NAVY,
          borderBottom: "1px solid rgba(248,92,0,0.28)",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: ORANGE,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 16,
              fontFamily: "Georgia, serif",
              boxShadow: "0 4px 14px rgba(248,92,0,0.5)",
            }}
          >
            SU
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            Course <span style={{ color: ORANGE }}>Scheduler</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            {session?.user?.name || session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              background: "transparent",
              border: "1.5px solid rgba(248,92,0,0.55)",
              color: ORANGE,
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            Advisor Workspace
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
            Pick a student record to begin advising, or create a new one below.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(220,53,53,0.15)",
              border: "1px solid rgba(220,53,53,0.4)",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "#ff8080",
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.35)",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "#4ade80",
              marginBottom: 20,
            }}
          >
            Student created successfully!
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.85fr",
            gap: 24,
          }}
        >
          {/* Students list */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Your Students</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 20px" }}>
              Select a student to open scheduling, recommendations, and academic imports.
            </p>

            {isLoading ? (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Loading students...</p>
            ) : students.length === 0 ? (
              <div
                style={{
                  border: "1.5px dashed rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: "32px 20px",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 13,
                }}
              >
                No students yet. Create the first record to begin advising.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openStudentWorkspace(student.id)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: "14px 18px",
                      textAlign: "left",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = ORANGE;
                      e.currentTarget.style.background = "rgba(248,92,0,0.09)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{student.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                        {[student.externalStudentId, student.major, student.academicYear]
                          .filter(Boolean)
                          .join(" · ") || "No metadata yet"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: ORANGE,
                        background: "rgba(248,92,0,0.15)",
                        borderRadius: 6,
                        padding: "4px 10px",
                      }}
                    >
                      Open →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add student form */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Add Student</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 20px" }}>
              Create a student record to own schedules, imports, and requirements.
            </p>

            <form onSubmit={handleCreateStudent} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Student Name</label>
                <input
                  id="name"
                  style={inputStyle}
                  placeholder="Jane Smith"
                  value={form.name}
                  required
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  onFocus={(e) => (e.target.style.borderColor = ORANGE)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                />
              </div>
              <div>
                <label htmlFor="externalStudentId" style={labelStyle}>SUID</label>
                <input
                  id="externalStudentId"
                  style={inputStyle}
                  placeholder="900123456"
                  value={form.externalStudentId}
                  onChange={(e) => setForm((c) => ({ ...c, externalStudentId: e.target.value }))}
                  onFocus={(e) => (e.target.style.borderColor = ORANGE)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                />
              </div>
              <div>
                <label htmlFor="email" style={labelStyle}>Student Email</label>
                <input
                  id="email"
                  type="email"
                  style={inputStyle}
                  placeholder="student@syr.edu"
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  onFocus={(e) => (e.target.style.borderColor = ORANGE)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="major" style={labelStyle}>Major</label>
                  <input
                    id="major"
                    style={inputStyle}
                    placeholder="Computer Science, BS"
                    value={form.major}
                    onChange={(e) => setForm((c) => ({ ...c, major: e.target.value }))}
                    onFocus={(e) => (e.target.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="academicYear" style={labelStyle}>Year</label>
                  <input
                    id="academicYear"
                    style={inputStyle}
                    placeholder="Junior"
                    value={form.academicYear}
                    onChange={(e) => setForm((c) => ({ ...c, academicYear: e.target.value }))}
                    onFocus={(e) => (e.target.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                style={{
                  marginTop: 4,
                  background: isCreating
                    ? "rgba(248,92,0,0.4)"
                    : `linear-gradient(135deg, ${ORANGE}, #cc4a00)`,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: isCreating ? "not-allowed" : "pointer",
                  boxShadow: isCreating ? "none" : "0 6px 20px rgba(248,92,0,0.4)",
                  transition: "all 0.2s",
                }}
              >
                {isCreating ? "Creating..." : "Create Student"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
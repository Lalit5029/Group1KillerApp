"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Registration failed. Please try again.");
        setIsLoading(false);
        return;
      }

      router.push("/login");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <ThemeToggle className="absolute right-4 top-4 z-50" />

      <div className="su-auth-hero flex min-h-[42vh] lg:min-h-screen lg:min-w-0 lg:flex-1">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-[-60px] right-[-60px] h-64 w-64 rounded-full bg-white/5" />
        <div className="relative z-10 max-w-md text-center lg:text-left">
          <div className="mb-7 inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-white/30 bg-white/15 font-serif text-3xl font-black text-white shadow-lg backdrop-blur-md">
            SU
          </div>
          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Join the advisor workspace
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-white/80 md:text-base">
            Create an account to manage student schedules, imports, and degree planning.
          </p>
          <ul className="mt-10 space-y-4 text-left text-sm text-white/85">
            {[
              "Secure advisor-scoped student records",
              "Course Planner with conflict detection",
              "Requirements and graduation readiness tools",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="su-auth-form-panel border-t border-border lg:w-[min(100%,460px)] lg:flex-none lg:border-l lg:border-t-0">
        <div className="mx-auto w-full max-w-[340px]">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            ← Back to login
          </Link>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">Create advisor account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Register to manage advisees and their academic plans
          </p>

          {error ? (
            <div
              className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} method="post" action="#" noValidate className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                autoComplete="name"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="netid@syr.edu"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="h-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="h-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <Button type="submit" className="mt-2 h-11 w-full text-base font-semibold shadow-md" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

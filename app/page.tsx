import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]">
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.25),rgba(1,183,231,0))] blur-2xl" />
        <div className="pointer-events-none absolute left-[-120px] top-[320px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.25),rgba(123,168,179,0))] blur-2xl" />

        {/* Header */}
        <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tl-mid)]">
              Taylor Leonard Corp
            </p>
            <h1 className="text-xl font-semibold text-[color:var(--tl-navy)]">
              CRM Portal
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-[color:var(--tl-mid)] hover:text-[color:var(--tl-navy)] transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[color:var(--tl-navy)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(1,34,79,0.2)] transition hover:bg-[color:var(--tl-deep)]"
            >
              Get Started
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 pt-12">
          <section className="text-center max-w-2xl mx-auto">
            <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--tl-teal)] bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)] mb-6">
              Client • Worker • Admin Portals
            </p>
            <h2 className="text-4xl sm:text-5xl font-semibold leading-tight text-[color:var(--tl-navy)]">
              One portal for projects, progress, and people.
            </h2>
            <p className="mt-6 text-lg text-[color:var(--tl-mid)] leading-relaxed">
              Keep clients informed, workers aligned, and admins in control.
              Track project status, approvals, and updates in one secure place.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                href="/register"
                className="rounded-full bg-[color:var(--tl-navy)] px-8 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(1,34,79,0.25)] transition hover:bg-[color:var(--tl-deep)]"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--tl-navy)] px-8 py-3 text-sm font-semibold text-[color:var(--tl-navy)] transition hover:bg-white"
              >
                Sign In
              </Link>
            </div>
          </section>

          {/* Role Cards */}
          <section className="mt-20 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6 shadow-[0_20px_40px_rgba(1,34,79,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--tl-cyan)]/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[color:var(--tl-navy)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Client Portal
              </h3>
              <p className="mt-2 text-sm text-[color:var(--tl-mid)] leading-relaxed">
                View your assigned projects, track progress, and stay updated on milestones and status changes.
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6 shadow-[0_20px_40px_rgba(1,34,79,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--tl-cyan)]/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[color:var(--tl-navy)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Worker Portal
              </h3>
              <p className="mt-2 text-sm text-[color:var(--tl-mid)] leading-relaxed">
                Update project details, add progress notes, and manage tasks for projects you&apos;re assigned to.
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6 shadow-[0_20px_40px_rgba(1,34,79,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--tl-cyan)]/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[color:var(--tl-navy)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Admin Portal
              </h3>
              <p className="mt-2 text-sm text-[color:var(--tl-mid)] leading-relaxed">
                Full access to all projects, users, and assignments. Create projects and assign team members.
              </p>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[color:var(--tl-sand)] bg-white/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-xs text-[color:var(--tl-mid)]">
          <span>© 2026 Taylor Leonard Corp</span>
          <span>CRM Portal v1.0</span>
        </div>
      </footer>
    </div>
  );
}

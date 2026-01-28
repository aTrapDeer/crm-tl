import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-(--bg) text-(--text)">
      <div className="relative min-h-screen overflow-hidden tl-hero">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-48 right-[-120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.35),rgba(1,183,231,0))] blur-3xl" />
          <div className="absolute left-[-140px] top-[340px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.35),rgba(123,168,179,0))] blur-3xl" />
        </div>

        <header className="fixed left-0 right-0 top-0 z-50 bg-[rgba(1,34,79,0.8)] backdrop-blur-xl border-b border-white/10 shadow-2xl">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/NoTextLogoFIXED.png"
                alt="Taylor Leonard Corp"
                width={48}
                height={48}
                className="h-10 w-10 sm:h-12 sm:w-12"
                priority
              />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-(--text) hover:text-white transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="tl-btn px-5 py-2 text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-32">
          <section className="text-center max-w-3xl mx-auto">
            <p className="tl-badge inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-[0.25em]">
              Client / Employee / Admin Portals
            </p>
            <h2 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight">
              One portal for projects, progress, and people.
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-(--text) leading-relaxed">
              Keep clients informed, employees aligned, and admins in control.
              Track project status, approvals, and updates in one secure place.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                href="/register"
                className="tl-btn px-8 py-3 text-sm sm:text-base"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="tl-btn-outline px-8 py-3 text-sm sm:text-base"
              >
                Sign In
              </Link>
            </div>
          </section>

          <section className="mt-20 grid gap-6 md:grid-cols-3">
            <div className="tl-card-dark p-6 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(1,183,231,0.2)]">
              <div className="w-12 h-12 rounded-full bg-(--bg)/40 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Client Portal</h3>
              <p className="mt-2 text-sm text-(--text) leading-relaxed">
                View your assigned projects, track progress, and stay updated on milestones and status changes.
              </p>
            </div>

            <div className="tl-card-dark p-6 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(1,183,231,0.2)]">
              <div className="w-12 h-12 rounded-full bg-(--bg)/40 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Worker Portal</h3>
              <p className="mt-2 text-sm text-(--text) leading-relaxed">
                Update project details, add progress notes, and manage tasks for projects you are assigned to.
              </p>
            </div>

            <div className="tl-card-dark p-6 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(1,183,231,0.2)]">
              <div className="w-12 h-12 rounded-full bg-(--bg)/40 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Admin Portal</h3>
              <p className="mt-2 text-sm text-(--text) leading-relaxed">
                Full access to all projects, users, and assignments. Create projects and assign team members.
              </p>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-(--border) bg-(--bg)">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-xs text-(--text)">
          <span>Copyright 2026 Taylor Leonard Corp</span>
          <span>CRM Portal v1.0</span>
        </div>
      </footer>
    </div>
  );
}


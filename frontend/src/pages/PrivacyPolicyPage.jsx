import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Server, Database, Eye, Terminal } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-800/90 bg-[#121214] p-6 sm:p-8 shadow-xl">
        {/* Document Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Privacy Policy
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Last updated: November 2026 • Effective immediately
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium self-start sm:self-auto">
            <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-white shadow-sm">
              Privacy Policy
            </span>
            <Link
              to="/terms"
              className="rounded-md px-3 py-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-6 rounded-lg border border-emerald-950/60 bg-emerald-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-200/90 leading-relaxed">
              <strong className="font-semibold text-emerald-100">At a glance:</strong>{' '}
              Tiny Vercel only accesses your repository files to compile and deploy your web projects inside isolated Google Cloud Run containers and store production bundles in Cloudflare R2. We do not sell your personal data or your proprietary source code.
            </div>
          </div>
        </div>

        {/* Content Clauses */}
        <div className="mt-8 space-y-8 text-xs text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Eye className="h-4 w-4 text-zinc-400" />
              1. Information We Collect
            </h2>
            <p>
              When you use Tiny Vercel, we collect the minimum necessary data to provide automated deployment, hosting, and proxy routing services:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>
                <strong className="text-zinc-300">Account Credentials:</strong> Name, email address, user avatar, and unique user identifiers provided securely via Clerk authentication.
              </li>
              <li>
                <strong className="text-zinc-300">Repository Metadata:</strong> Git repository URLs, branch names, subfolder paths, and project configuration slugs necessary to clone and build your applications.
              </li>
              <li>
                <strong className="text-zinc-300">Environment Variables:</strong> User-configured secrets and environment key-value pairs stored encrypted at rest and injected into container build environments.
              </li>
              <li>
                <strong className="text-zinc-300">Build Logs & Telemetry:</strong> Standard output (<code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded font-mono">stdout</code>) and standard error (<code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded font-mono">stderr</code>) logs emitted by your build scripts, streamed to Apache Kafka and archived in ClickHouse Cloud.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-400" />
              2. How We Use Your Information
            </h2>
            <p>We use the data collected strictly to operate and enhance the Tiny Vercel engine:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>Cloning your specified GitHub repositories and executing build commands inside isolated sandboxes.</li>
              <li>Uploading compiled static bundles (HTML, JS, CSS, media) to Cloudflare R2 object storage.</li>
              <li>Routing web traffic from custom subdomains (<code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded font-mono">*.tinyvercel.dev</code>) to deployed assets via our edge reverse proxy.</li>
              <li>Rendering live deployment logs and execution phases in your project dashboard.</li>
              <li>Preventing malicious misuse, cryptocurrency mining, and unauthorized compute consumption.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-zinc-400" />
              3. Third-Party Infrastructure & Subprocessors
            </h2>
            <p>
              To maintain high reliability and performance, Tiny Vercel utilizes select trusted cloud providers:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
                <span className="font-semibold text-zinc-200">Clerk</span>
                <p className="text-[11px] text-zinc-400 mt-1">Identity verification, session authentication, and account security management.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
                <span className="font-semibold text-zinc-200">Cloudflare R2</span>
                <p className="text-[11px] text-zinc-400 mt-1">Global S3-compatible object storage for compiled client-side static artifacts.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
                <span className="font-semibold text-zinc-200">Google Cloud Run</span>
                <p className="text-[11px] text-zinc-400 mt-1">Ephemeral container runtime for automated project cloning, dependency installation, and bundling.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
                <span className="font-semibold text-zinc-200">ClickHouse Cloud & Kafka</span>
                <p className="text-[11px] text-zinc-400 mt-1">High-throughput real-time streaming and analytical query storage for build logs.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-400" />
              4. Data Retention and Project Deletion
            </h2>
            <p>
              You maintain total control over your deployed assets. When you delete a project from Tiny Vercel:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>All compiled static files belonging to the project are purged from Cloudflare R2 storage.</li>
              <li>Project records, deployment history, and configuration metadata are deleted from our database.</li>
              <li>Build telemetry logs are retained for an audit window of 30 days before automatic expiration.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              5. Security Practices
            </h2>
            <p>
              We enforce multi-tenant isolation, HTTPS/TLS encryption in transit, and secret token authorization for all internal services. Build tasks execute in stateless, ephemeral containers with restricted host privileges.
            </p>
          </section>

          <section className="space-y-3 border-t border-zinc-800/80 pt-6">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              6. Contact & Data Inquiries
            </h2>
            <p>
              If you have any questions about this Privacy Policy, or wish to exercise your rights to access or delete personal data, please contact our team at{' '}
              <a
                href="mailto:privacy@tinyvercel.dev"
                className="text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                privacy@tinyvercel.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

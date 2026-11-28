import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Cpu, Scale, Ban } from 'lucide-react';

export default function TermsOfServicePage() {
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
              <FileText className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Terms of Service
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Last updated: November 2026 • Version 1.0
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium self-start sm:self-auto">
            <Link
              to="/privacy"
              className="rounded-md px-3 py-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-white shadow-sm">
              Terms of Service
            </span>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-6 rounded-lg border border-indigo-950/60 bg-indigo-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs text-indigo-200/90 leading-relaxed">
              <strong className="font-semibold text-indigo-100">Summary:</strong>{' '}
              You retain 100% intellectual property rights to your source code and deployed web applications. In return, you agree to build lawful web apps and respect container resource limits. Cryptocurrency mining, malware, and platform abuse will result in immediate suspension.
            </div>
          </div>
        </div>

        {/* Content Clauses */}
        <div className="mt-8 space-y-8 text-xs text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Scale className="h-4 w-4 text-zinc-400" />
              1. Acceptance of Terms
            </h2>
            <p>
              By registering an account, connecting a repository, or triggering a deployment on Tiny Vercel ("the Platform"), you agree to abide by these Terms of Service. If you do not agree to these terms, you must not access or use the Platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Ban className="h-4 w-4 text-amber-400" />
              2. Acceptable Use Policy & Compute Runner Rules
            </h2>
            <p>
              Build containers execute on shared cloud compute infrastructure (Google Cloud Run). To protect system availability and integrity, you strictly agree NOT to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>
                <strong className="text-zinc-300">Mine Cryptocurrency:</strong> Execute any proof-of-work scripts, coin miners, or distributed compute networks.
              </li>
              <li>
                <strong className="text-zinc-300">Distribute Malicious Software:</strong> Host, compile, or distribute malware, ransomware, botnet controllers, or spyware.
              </li>
              <li>
                <strong className="text-zinc-300">Attack or Probe Infrastructure:</strong> Perform denial-of-service (DDoS) attacks, network port scans, or stress testing against internal services, proxies, or external targets.
              </li>
              <li>
                <strong className="text-zinc-300">Evade Resource Limits:</strong> Circumvent memory, CPU, or container timeout limits through background forks or daemons.
              </li>
            </ul>
            <p className="text-amber-300/90 bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 mt-2">
              <strong>Enforcement:</strong> Any violation of the Acceptable Use Policy results in instantaneous termination of the active build, immediate deletion of associated subdomains, and permanent account blacklisting without notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-zinc-400" />
              3. Source Code Ownership & Licenses
            </h2>
            <p>
              <strong className="text-zinc-200">Your Intellectual Property:</strong> You retain complete ownership, copyright, and intellectual property rights in your repository source code, build configurations, and compiled static assets. Tiny Vercel does not claim any ownership over your code.
            </p>
            <p>
              <strong className="text-zinc-200">Limited Operational License:</strong> Solely to provide the deployment and hosting service, you grant Tiny Vercel a worldwide, royalty-free license to clone your repository, install specified dependencies, compile bundles, and serve static assets via our edge reverse proxy to end users on your chosen subdomain.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-zinc-400" />
              4. Service Availability & Disclaimers
            </h2>
            <p>
              The Platform is provided on an <strong className="text-zinc-200">"AS IS"</strong> and <strong className="text-zinc-200">"AS AVAILABLE"</strong> basis without warranties of any kind, whether express or implied.
            </p>
            <p>
              While Tiny Vercel targets high availability across its reverse proxy and storage endpoints, we do not warrant that operation will be uninterrupted, error-free, or entirely secure. You are encouraged to maintain independent backups of your application source code.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Scale className="h-4 w-4 text-zinc-400" />
              5. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, in no event shall Tiny Vercel, its contributors, or cloud providers be liable for any indirect, consequential, punitive, or special damages—including lost profits, data corruption, or service interruption—arising from the use or inability to use the service.
            </p>
          </section>

          <section className="space-y-3 border-t border-zinc-800/80 pt-6">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              6. Modifications to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. When changes occur, the "Last Updated" timestamp will be refreshed. Continued use of the service following revisions constitutes acceptance of the new terms.
            </p>
            <p className="mt-2 text-zinc-400">
              Questions regarding these Terms? Contact{' '}
              <a
                href="mailto:legal@tinyvercel.dev"
                className="text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                legal@tinyvercel.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

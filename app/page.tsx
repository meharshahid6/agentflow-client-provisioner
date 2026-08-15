export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.18em] text-cyan-300 uppercase">
            Agentflow
          </p>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            Foundation v0.1
          </span>
        </header>

        <section className="max-w-3xl py-20">
          <p className="mb-5 text-sm font-medium text-slate-400">Client operations workspace</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Provision client environments with clarity.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            The Agentflow Client Provisioner foundation is ready for the next phase of building
            reliable, repeatable client setup workflows.
          </p>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-800 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Next.js · TypeScript · Tailwind CSS</span>
          <span>No external integrations configured</span>
        </footer>
      </div>
    </main>
  );
}

function ShieldSearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5l7 2.8v5.4c0 4.9-3 9.3-7 10.8-4-1.5-7-5.9-7-10.8V5.3l7-2.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10.6" cy="10.6" r="2.9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12.7 12.7L15 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 justify-center bg-white">
      <main className="flex w-full max-w-lg flex-col gap-6 px-5 py-10 sm:px-8">
        <header className="flex items-center gap-2">
          <ShieldSearchIcon className="h-8 w-8 text-brand" />
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Second Look
          </h1>
        </header>

        <p className="text-lg leading-relaxed text-zinc-600">
          Before you pay, take a second look.
        </p>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="message"
            className="text-base font-medium text-zinc-700"
          >
            Paste the message you received
          </label>
          <textarea
            id="message"
            name="message"
            rows={8}
            placeholder="Hola, soy tu proveedor, cambiamos de cuenta bancaria..."
            className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-base leading-relaxed text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <button
          type="button"
          className="w-full rounded-full bg-brand px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark active:bg-brand-dark"
        >
          Take a second look
        </button>

        <div id="result" aria-live="polite" />
      </main>
    </div>
  );
}

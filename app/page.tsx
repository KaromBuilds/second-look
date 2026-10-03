"use client";

import { useMemo, useState, type ReactNode } from "react";
import { redact } from "@/lib/redact";

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

const HIDDEN_TAG_RE = /\[(?:CURP|RFC|CARD|CLABE|PHONE|EMAIL|SECRET) HIDDEN\]/g;

// Renders the redacted text with each "[... HIDDEN]" tag as a grey pill,
// matching the mockup, instead of showing the raw brackets as plain text.
function renderPreview(clean: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of clean.matchAll(HIDDEN_TAG_RE)) {
    const index = match.index;
    if (index > lastIndex) {
      nodes.push(clean.slice(lastIndex, index));
    }
    nodes.push(
      <span
        key={key++}
        className="inline-block whitespace-nowrap rounded-full bg-zinc-200 px-2.5 py-0.5 text-base font-medium text-zinc-600"
      >
        {match[0]}
      </span>,
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < clean.length) {
    nodes.push(clean.slice(lastIndex));
  }

  return nodes;
}

export default function Home() {
  const [message, setMessage] = useState("");
  const { clean, found } = useMemo(() => redact(message), [message]);
  const totalHidden = found.reduce((sum, item) => sum + item.count, 0);
  const hasText = message.trim().length > 0;

  return (
    <div className="min-h-full bg-white">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-10 sm:px-8">
        <header className="flex items-center gap-3">
          <ShieldSearchIcon className="h-10 w-10 shrink-0 text-brand" />
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
            Second Look
          </h1>
        </header>

        <p className="text-xl leading-relaxed text-zinc-600">
          Before you pay, take a second look.
        </p>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="message"
            className="text-lg font-medium text-zinc-700"
          >
            Paste the message you received
          </label>
          <textarea
            id="message"
            name="message"
            rows={8}
            cols={1}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Hi, this is your supplier, we changed bank accounts..."
            className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-lg leading-relaxed text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {hasText && (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-medium text-zinc-700">
              What we&apos;ll check
            </p>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-lg leading-relaxed text-zinc-900">
              {renderPreview(clean)}
            </div>
            <p className="flex items-center gap-2 text-base font-medium text-brand">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-brand"
                aria-hidden="true"
              />
              {totalHidden} private{" "}
              {totalHidden === 1 ? "detail" : "details"} hidden before
              checking — nothing was sent.
            </p>
          </div>
        )}

        <button
          type="button"
          className="w-full rounded-full bg-brand px-6 py-5 text-xl font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark active:bg-brand-dark"
        >
          Take a second look
        </button>

        <div id="result" aria-live="polite" />
      </main>
    </div>
  );
}

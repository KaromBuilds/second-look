"use client";

import { useMemo, useState, type ReactNode } from "react";
import ResultCard from "@/components/ResultCard";
import { friendlyCheckError } from "@/lib/checkLimits";
import { redact } from "@/lib/redact";
import { extractUrls } from "@/lib/urls";
import type { CheckResult } from "@/lib/verdict";

type Status = "idle" | "loading" | "error" | "success";

// Explicit width/height (not just a CSS class) so the icon can never fall
// back to the browser's native ~300x150 replaced-element default if the
// stylesheet fails to load — they're a floor, and CSS width/height classes
// in `className` still win whenever the stylesheet is present.
function ShieldSearchIcon({
  className,
  size,
}: {
  className?: string;
  size: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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

const HOW_IT_WORKS = [
  "Paste the message you received.",
  "We hide your private data before checking — nothing leaves your browser.",
  "Get a plain-language verdict and three safe steps.",
];

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
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const { clean, found } = useMemo(() => redact(message), [message]);
  const totalHidden = found.reduce((sum, item) => sum + item.count, 0);
  const hasText = message.trim().length > 0;

  function handleMessageChange(value: string) {
    setMessage(value);
    setStatus("idle");
    setErrorMessage(null);
    setResult(null);
  }

  async function handleCheck() {
    const validationError = friendlyCheckError(clean, extractUrls(clean).length);
    if (validationError) {
      setStatus("error");
      setErrorMessage(validationError);
      setResult(null);
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Something went wrong. Please check your connection and try again.",
      );
    }
  }

  return (
    <div className="min-h-full bg-white">
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-20">
        <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[1fr_440px] lg:items-start lg:gap-16">
          {/* Hero */}
          <div className="flex flex-col gap-6 lg:gap-8">
            <header className="flex items-center gap-3 lg:gap-4">
              <ShieldSearchIcon
                size={40}
                className="h-10 w-10 shrink-0 text-brand lg:h-14 lg:w-14"
              />
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 lg:text-[56px]">
                Second Look
              </h1>
            </header>

            <p className="text-xl leading-relaxed text-zinc-600 lg:text-[24px]">
              Before you pay, take a second look.
            </p>

            <p className="text-lg leading-relaxed text-zinc-600 lg:max-w-xl lg:text-xl">
              Paste a suspicious WhatsApp, SMS or email message and get a
              plain-language verdict in under 30 seconds — checked against
              known scam patterns and real threat data, with your private
              details hidden on your device before anything is sent.
            </p>

            <ol className="flex flex-col gap-4">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-base font-semibold text-brand-dark">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-lg leading-relaxed text-zinc-700">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand-light px-4 py-2 text-base font-medium text-brand-dark">
              <ShieldSearchIcon size={16} className="h-4 w-4 shrink-0" />
              Nothing you paste is stored
            </div>
          </div>

          {/* Check card */}
          <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-md transition-shadow duration-300 hover:shadow-lg lg:p-8">
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
                onChange={(event) => handleMessageChange(event.target.value)}
                placeholder="Hi, this is your supplier, we changed bank accounts..."
                className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-lg leading-relaxed text-zinc-900 shadow-sm transition-colors duration-150 placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 lg:text-[19px]"
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
              onClick={handleCheck}
              disabled={status === "loading"}
              className="flex w-full items-center justify-center rounded-full bg-brand px-6 py-5 text-xl font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-lg active:translate-y-0 active:bg-brand-dark disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 disabled:shadow-sm lg:h-[64px] lg:py-0 lg:text-[20px]"
            >
              {status === "loading" ? "Checking…" : "Take a second look"}
            </button>
          </div>
        </div>

        {/* Result */}
        <div
          id="result"
          aria-live="polite"
          className="mt-10 flex flex-col gap-2 lg:mt-14"
        >
          {status === "error" && errorMessage && (
            <p className="rounded-2xl border border-warning/30 bg-warning-light px-4 py-3 text-base font-medium text-warning lg:mx-auto lg:max-w-3xl lg:px-6 lg:py-4 lg:text-lg">
              {errorMessage}
            </p>
          )}

          {status === "success" && result && (
            <div className="flex flex-col gap-6">
              <ResultCard result={result} hadPersonalData={totalHidden > 0} />
              <button
                type="button"
                onClick={() => handleMessageChange("")}
                className="self-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Check another message
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import type { CheckResult, VerdictLabel } from "@/lib/verdict";

// A raw percentage asks the reader to supply their own sense of what
// counts as "high" — found during the Don Ramiro persona walkthrough to
// be a likely stumble for a non-technical reader with no baseline to
// compare it to. A plain-language qualifier next to the number removes
// that translation step entirely.
function confidenceLabel(confidence: number): string {
  if (confidence >= 80) return "Very sure";
  if (confidence >= 60) return "Fairly sure";
  return "Not very sure";
}

const VERDICT_STYLE: Record<
  VerdictLabel,
  { label: string; header: string; band: string; text: string }
> = {
  likely_scam: {
    label: "Likely scam",
    header: "bg-warning",
    band: "bg-warning-light",
    text: "text-warning",
  },
  suspicious: {
    label: "Suspicious",
    header: "bg-caution",
    band: "bg-caution-light",
    text: "text-caution",
  },
  looks_ok: {
    label: "Looks OK",
    header: "bg-brand",
    band: "bg-brand-light",
    text: "text-brand-dark",
  },
};

export default function ResultCard({
  result,
  hadPersonalData,
}: {
  result: CheckResult;
  // Whether lib/redact.ts found any CURP/RFC/card/CLABE/phone/email/secret
  // in the message — known client-side (Feature 2's live preview already
  // computes it), not something the already-redacted text sent to the
  // server could prove on its own.
  hadPersonalData: boolean;
}) {
  const style = VERDICT_STYLE[result.verdict];

  return (
    <div className="flex flex-col gap-6 lg:max-w-3xl">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 shadow-md">
        <div className={`${style.header} px-6 py-5`}>
          <p className="text-xl font-bold text-white sm:text-2xl">
            {style.label}: {result.scam_type}
          </p>
        </div>

        <div className={`${style.band} px-6 py-4`}>
          <div className="flex items-center gap-3">
            <p className={`shrink-0 text-base font-medium ${style.text}`}>
              Confidence {result.confidence}% — {confidenceLabel(result.confidence)}
            </p>
            <div
              role="progressbar"
              aria-valuenow={result.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-white/60"
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 bg-white px-6 py-6">
          <p className="text-lg leading-relaxed text-zinc-700">
            {result.explanation}
          </p>

          <ol className="flex flex-col gap-3">
            {result.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-dark">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-base leading-relaxed text-zinc-700">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          {result.dangerous_link && (
            <p className="rounded-2xl border border-warning/30 bg-warning-light px-4 py-3 text-base font-medium text-warning">
              Dangerous link found: {result.flagged_domains.join(", ")}
            </p>
          )}
          {result.link_check_unavailable && (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-600">
              Link check unavailable right now
            </p>
          )}

          {result.red_flags.length > 0 && (
            <details className="text-base text-zinc-600">
              <summary className="cursor-pointer font-medium text-zinc-700">
                Why?
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {result.red_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="bg-zinc-50 px-6 py-3">
          <p className="text-sm text-zinc-400">
            Pattern library: {result.pattern_library}
            {result.source === "basic" && " · Basic check (AI unavailable)"}
          </p>
        </div>
      </div>

      {result.escalate && <GetHumanHelp hadPersonalData={hadPersonalData} />}
    </div>
  );
}

function GetHumanHelp({ hadPersonalData }: { hadPersonalData: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-warning/30 bg-warning-light p-6 shadow-sm">
      <p className="text-xl font-bold text-zinc-900">Get human help</p>
      <p className="text-base leading-relaxed text-zinc-700">
        This one is serious enough that it&apos;s worth talking to a real
        person. Here&apos;s who to contact:
      </p>

      <ul className="flex flex-col gap-3 text-base text-zinc-700">
        <li>
          <span className="font-semibold text-zinc-900">Your bank:</span>{" "}
          call using the number on the back of your card — not any number
          from the message.
        </li>
        <li>
          <span className="font-semibold text-zinc-900">CONDUSEF</span>{" "}
          (Mexico&apos;s financial consumer protection agency):{" "}
          <a
            href="https://www.condusef.gob.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-dark underline underline-offset-2"
          >
            condusef.gob.mx
          </a>
        </li>
        <li>
          <span className="font-semibold text-zinc-900">
            Policía Cibernética
          </span>{" "}
          (SSC CDMX):{" "}
          <a
            href="tel:+525552425100"
            className="font-medium text-brand-dark underline underline-offset-2"
          >
            55 5242 5100
          </a>{" "}
          ext. 5086, or{" "}
          <a
            href="tel:088"
            className="font-medium text-brand-dark underline underline-offset-2"
          >
            088
          </a>
        </li>
        {hadPersonalData && (
          <li>
            <span className="font-semibold text-zinc-900">
              Buró de Crédito
            </span>{" "}
            — consider a lock/alert on your credit file, since this
            message may have been trying to get your personal data:{" "}
            <a
              href="https://www.burodecredito.com.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-dark underline underline-offset-2"
            >
              burodecredito.com.mx
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

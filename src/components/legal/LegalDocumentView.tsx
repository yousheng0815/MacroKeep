import type { LegalDocument } from "@/content/legal/types";

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="prose-legal">
      <p className="text-sm text-mk-muted">
        Effective date: {doc.effectiveDate}
      </p>
      {doc.intro.map((p) => (
        <p key={p.slice(0, 48)} className="mt-4 text-sm leading-relaxed text-zinc-300">
          {p}
        </p>
      ))}
      {doc.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-base font-semibold text-white">{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p
              key={p.slice(0, 48)}
              className="mt-3 text-sm leading-relaxed text-zinc-300"
            >
              {p}
            </p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
              {section.bullets.map((item) => (
                <li key={item.slice(0, 48)}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

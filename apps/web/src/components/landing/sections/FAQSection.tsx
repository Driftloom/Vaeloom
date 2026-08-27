import { FAQ } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';

export default function FAQSection() {
  return (
    <Section id="faq" labelledBy="faq-title">
      <Container>
        <SectionHeading id="faq-title" eyebrow={FAQ.eyebrow} title={FAQ.title} />
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border-subtle">
          {FAQ.items.map((item) => (
            <Reveal key={item.q}>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                  <span className="text-sm font-semibold text-text sm:text-base">{item.q}</span>
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-secondary transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

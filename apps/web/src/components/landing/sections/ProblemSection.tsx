import { PROBLEM } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';

export default function ProblemSection() {
  return (
    <Section id="problem" labelledBy="problem-title">
      <Container>
        <SectionHeading
          id="problem-title"
          eyebrow={PROBLEM.eyebrow}
          title={PROBLEM.title}
          intro={PROBLEM.intro}
        />

        <ol className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM.steps.map((s, i) => (
            <li key={s.title} className="h-full">
              <Reveal delay={i * 0.06} className="h-full">
                <div className="landing-panel flex h-full flex-col rounded-2xl p-5">
                  <span className="font-mono text-xs font-semibold text-primary-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-2 text-sm font-bold text-text">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{s.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal className="mx-auto mt-8 max-w-2xl text-center">
          <p className="font-display text-lg italic text-text-secondary">{PROBLEM.resolution}</p>
        </Reveal>
      </Container>
    </Section>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { Instrument_Serif, Inter } from 'next/font/google';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default function AxonHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const fallback = fallbackRef.current;
    if (!video || !container) return;

    const onVideoError = () => {
      video.style.display = 'none';
      if (fallback) fallback.style.opacity = '1';
    };
    video.addEventListener('error', onVideoError);

    // Try to load the video; if it fails, fallback will show
    // Use currentSrc check after a delay
    const checkTimer = setTimeout(() => {
      if (video.readyState === 0 && video.networkState === 3) {
        onVideoError();
      }
    }, 3000);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = rect.height - vh;
        const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        const maxTranslate = video.offsetHeight - vh;
        const y = progress * maxTranslate * 0.6;
        video.style.transform = `translateY(-${y}px)`;
        if (fallback) fallback.style.transform = `translateY(-${y * 0.3}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      clearTimeout(checkTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      video.removeEventListener('error', onVideoError);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-[140vh] w-full bg-white"
      style={{ fontFamily: "'Inter', sans-serif", color: '#1B133C' }}
    >
      <section
        className={`${inter.className} sticky top-0 relative h-screen w-full overflow-hidden flex flex-col`}
        style={{ color: '#1B133C' }}
      >
        {/* Fallback background */}
        <div
          ref={fallbackRef}
          className="absolute inset-0 z-0 w-full h-[130%] will-change-transform"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, #E8E6F0 0%, #F5F3FF 40%, #FFFFFF 100%)',
          }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #1B133C 1px, transparent 1px), linear-gradient(to bottom, #1B133C 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>
        {/* Background video */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260714_113715_c7e0daa0-8bdd-4486-a2da-040901f8f0ea.mp4"
          className="absolute inset-0 z-0 w-full h-[130%] object-cover object-top will-change-transform bg-transparent"
          onError={(e) => {
            const v = e.currentTarget;
            v.style.display = 'none';
            if (fallbackRef.current) fallbackRef.current.style.opacity = '1';
          }}
        />

        {/* Navigation */}
        <nav className="relative z-10 flex justify-center pt-4 md:pt-6 px-4">
          <div className="flex items-center gap-6 bg-white/70 backdrop-blur-md rounded-xl px-4 md:px-6 py-3 shadow-sm">
            {/* Logo */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 256 256"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Axon logo"
            >
              <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z" fill="#1B133C" />
              <path d="M 256 128 L 128 128 L 0 0 L 128 0 Z" fill="#1B133C" />
            </svg>
            <div className="hidden sm:flex items-center gap-6">
              <a
                href="#"
                className="text-sm font-medium text-[#1B133C]/80 hover:text-[#1B133C] transition-colors"
              >
                Features
              </a>
              <a
                href="#"
                className="text-sm font-medium text-[#1B133C]/80 hover:text-[#1B133C] transition-colors"
              >
                Plans
              </a>
              <a
                href="#"
                className="text-sm font-medium text-[#1B133C]/80 hover:text-[#1B133C] transition-colors"
              >
                Security
              </a>
              <a
                href="#"
                className="text-sm font-medium text-[#1B133C]/80 hover:text-[#1B133C] transition-colors"
              >
                About
              </a>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center mt-8 md:mt-16 pb-12">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#1B133C]/10 bg-white/70 backdrop-blur-sm px-4 py-2 text-sm font-medium">
            <span className="flex items-center justify-center bg-orange-500 rounded w-5 h-5 text-white text-xs font-bold leading-none">
              Y
            </span>
            <span>Funded by Y Combinator</span>
          </div>

          {/* Heading */}
          <h1
            className={`${instrumentSerif.className} text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-[#1B133C] max-w-4xl`}
          >
            Deploy digital workers
            <br />
            for mundane workflows
          </h1>

          {/* Subtitle */}
          <p className="mt-5 sm:mt-6 max-w-3xl text-xs sm:text-sm md:text-base leading-relaxed text-[#1B133C]/70">
            Eliminate your tedious browser work and 10x your team&apos;s capacity. Put intelligent
            agents on every routine process so you grow faster and deliver more for clients —
            effortlessly.
          </p>

          {/* CTA */}
          <a
            href="#"
            className="mt-7 sm:mt-8 inline-flex items-center justify-center rounded-xl bg-[#FEFEFE] px-6 sm:px-8 py-3 sm:py-3.5 text-sm font-semibold text-[#1B133C] shadow-[0px_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0px_6px_16px_rgba(0,0,0,0.2)] transition-all duration-300"
          >
            Get Early Access
          </a>
        </div>
      </section>
    </div>
  );
}

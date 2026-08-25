import type { Metadata } from 'next';
import AxonHero from './AxonHero';

export const metadata: Metadata = {
  title: 'Axon — Digital Workers for Mundane Workflows',
  description:
    "Eliminate your tedious browser work and 10x your team's capacity. Put intelligent agents on every routine process.",
};

export default function Page() {
  return <AxonHero />;
}

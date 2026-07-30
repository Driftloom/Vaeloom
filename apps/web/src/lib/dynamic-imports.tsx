import dynamic from 'next/dynamic';
import { LoadingFallback } from './lazy-imports';

export const DynamicChatWindow = dynamic(
  () => import('@/components/chat/ChatWindow').then((m) => ({ default: m.ChatWindow })),
  { loading: () => <LoadingFallback text="Loading chat..." /> },
);

export const DynamicGraphViewer = dynamic(
  () => import('@/components/memory/GraphViewer').then((m) => ({ default: m.GraphViewer })),
  { loading: () => <LoadingFallback text="Loading memory graph..." /> },
);

export const DynamicResumeBuilder = dynamic(
  () => import('@/components/resume/ResumeBuilder').then((m) => ({ default: m.ResumeBuilder })),
  { loading: () => <LoadingFallback text="Loading resume builder..." /> },
);

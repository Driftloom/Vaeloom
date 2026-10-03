'use client';
import React from 'react';
import { DocumentsHub } from '@/components/documents/DocumentsHub';

export default function WorkspaceFilesPage() {
  return <DocumentsHub basePath="files" />;
}

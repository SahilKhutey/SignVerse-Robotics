import React from 'react';
import { DashboardShell } from '@/layouts/DashboardShell';
import { GridLayout } from '@/layouts/GridLayout';

export default function MissionControlWorkspace() {
  return (
    <DashboardShell>
      <GridLayout />
    </DashboardShell>
  );
}

import React from 'react';
import { Header } from '@/components/dashboard/Header';
import { ActiveOutagesPanel } from '@/components/dashboard/ActiveOutagesPanel';
import { VendorStatusPanel } from '@/components/dashboard/VendorStatusPanel';
import { MonitoringAlertsPanel } from '@/components/dashboard/MonitoringAlertsPanel';
import { ServiceNowTicketsPanel } from '@/components/dashboard/ServiceNowTicketsPanel';
import { ActiveCollaborationBridgesPanel } from '@/components/dashboard/ActiveCollaborationBridgesPanel';
import { OutageTrendsPanel } from '@/components/dashboard/OutageTrendsPanel';
export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Header />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            <ActiveOutagesPanel />
            <OutageTrendsPanel />
          </div>
          {/* Sidebar Column */}
          <div className="lg:col-span-1 space-y-6">
            <ActiveCollaborationBridgesPanel />
            <VendorStatusPanel />
            <MonitoringAlertsPanel />
            <ServiceNowTicketsPanel />
          </div>
        </div>
      </main>
      <footer className="text-center py-4 text-muted-foreground text-sm">
        <p>Built with ❤️ at Cloudflare</p>
      </footer>
    </div>
  );
}
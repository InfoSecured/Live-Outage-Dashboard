import React from 'react';
import { Header } from '@/components/dashboard/Header';
import { ActiveOutagesPanel } from '@/components/dashboard/ActiveOutagesPanel';
import { VendorStatusPanel } from '@/components/dashboard/VendorStatusPanel';
import { MonitoringAlertsPanel } from '@/components/dashboard/MonitoringAlertsPanel';
import { ServiceNowTicketsPanel } from '@/components/dashboard/ServiceNowTicketsPanel';
import { ActiveCollaborationBridgesPanel } from '@/components/dashboard/ActiveCollaborationBridgesPanel';
import { OutageTrendsPanel } from '@/components/dashboard/OutageTrendsPanel';
import { ScheduledChangesPanel } from '@/components/dashboard/ScheduledChangesPanel';
import { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshControls from '../components/RefreshControls';

export function HomePage() {
  const [managementEnabled, setManagementEnabled] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // NEW: a token that increments on every refresh
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const checkManagementEnabled = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setManagementEnabled(data.enableManagement);
      } catch {
        setManagementEnabled(false);
      }
    };
    checkManagementEnabled();
  }, []);

  useEffect(() => {
    const savedEnabled = localStorage.getItem('autoRefreshEnabled');
    const savedInterval = localStorage.getItem('autoRefreshInterval');
    if (savedEnabled !== null) setAutoRefreshEnabled(savedEnabled === 'true');
    if (savedInterval !== null) {
      const iv = parseInt(savedInterval, 10);
      if (!isNaN(iv) && iv > 0) setRefreshInterval(iv);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Panels will react to refreshTick changing
      setRefreshTick((t) => t + 1);
      // tiny delay so the spinner is visible (optional)
      await new Promise((r) => setTimeout(r, 250));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAutoRefresh({
    enabled: autoRefreshEnabled,
    intervalMinutes: refreshInterval,
    onRefresh: fetchData,
  });

  const handleRefreshToggle = (enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    localStorage.setItem('autoRefreshEnabled', enabled.toString());
    if (enabled) fetchData();
  };

  const handleIntervalChange = (minutes: number) => {
    setRefreshInterval(minutes);
    localStorage.setItem('autoRefreshInterval', minutes.toString());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Header />

        <div className="mb-6">
          <RefreshControls
            onRefreshToggle={handleRefreshToggle}
            onIntervalChange={handleIntervalChange}
            isRefreshing={isRefreshing}
            autoRefreshEnabled={autoRefreshEnabled}
            refreshInterval={refreshInterval}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* PASS refreshTick into panels that should re-fetch */}
            <ActiveOutagesPanel managementEnabled={managementEnabled} refreshTick={refreshTick} />
            <ScheduledChangesPanel managementEnabled={managementEnabled} refreshTick={refreshTick} />
            <OutageTrendsPanel refreshTick={refreshTick} />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <ActiveCollaborationBridgesPanel managementEnabled={managementEnabled} refreshTick={refreshTick} />
            <VendorStatusPanel managementEnabled={managementEnabled} refreshTick={refreshTick} />
            <MonitoringAlertsPanel managementEnabled={managementEnabled} refreshTick={refreshTick} />
            <ServiceNowTicketsPanel refreshTick={refreshTick} />
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-muted-foreground text-sm">
        <p>Built with ❤️ at Cloudflare</p>
      </footer>
    </div>
  );
}

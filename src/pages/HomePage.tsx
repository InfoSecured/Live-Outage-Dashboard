import React from 'react';
import { Header } from '@/components/dashboard/Header';
import { ActiveOutagesPanel } from '@/components/dashboard/ActiveOutagesPanel';
import { VendorStatusPanel } from '@/components/dashboard/VendorStatusPanel';
import { MonitoringAlertsPanel } from '@/components/dashboard/MonitoringAlertsPanel';
import { ServiceNowTicketsPanel } from '@/components/dashboard/ServiceNowTicketsPanel';
import { ActiveCollaborationBridgesPanel } from '@/components/dashboard/ActiveCollaborationBridgesPanel';
import { OutageTrendsPanel } from '@/components/dashboard/OutageTrendsPanel';
import { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshControls from '../components/RefreshControls';

export function HomePage() {
  // STATE DECLARATIONS - MUST come first!
  const [managementEnabled, setManagementEnabled] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check management status on mount
  useEffect(() => {
    const checkManagementEnabled = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setManagementEnabled(data.enableManagement);
      } catch (error) {
        console.error('Failed to check management status:', error);
        setManagementEnabled(false);
      }
    };
    
    checkManagementEnabled();
  }, []);
  
  // Load saved auto-refresh settings
  useEffect(() => {
    const savedEnabled = localStorage.getItem('autoRefreshEnabled');
    const savedInterval = localStorage.getItem('autoRefreshInterval');
    
    if (savedEnabled !== null) {
      setAutoRefreshEnabled(savedEnabled === 'true');
    }
    if (savedInterval !== null) {
      const interval = parseInt(savedInterval, 10);
      if (!isNaN(interval) && interval > 0) {
        setRefreshInterval(interval);
      }
    }
  }, []);
  
  // Fetch data callback
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // The panels handle their own data fetching
      // This just triggers a refresh state for the UI
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);
  
  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Auto-refresh hook
  useAutoRefresh({
    enabled: autoRefreshEnabled,
    intervalMinutes: refreshInterval,
    onRefresh: fetchData,
  });
  
  // Event handlers
  const handleRefreshToggle = (enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    localStorage.setItem('autoRefreshEnabled', enabled.toString());
    
    if (enabled) {
      fetchData();
    }
  };
  
  const handleIntervalChange = (minutes: number) => {
    setRefreshInterval(minutes);
    localStorage.setItem('autoRefreshInterval', minutes.toString());
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Header />
        
        {/* Refresh Controls */}
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
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            <ActiveOutagesPanel managementEnabled={managementEnabled} />
            <OutageTrendsPanel />
          </div>
          {/* Sidebar Column */}
          <div className="lg:col-span-1 space-y-6">
            <ActiveCollaborationBridgesPanel managementEnabled={managementEnabled} />
            <VendorStatusPanel managementEnabled={managementEnabled} />
            <MonitoringAlertsPanel managementEnabled={managementEnabled} />
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

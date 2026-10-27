import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type GraphState = {
  id: string;
  chartType: 'bar' | 'line' | 'scatter';
  visibleColumns?: string[];
  title?: string;
};

export type TabState = {
  id: string;
  name: string;
  datasets: number[];
  notes: string;
  graphs: GraphState[];
};

type VisualizationContextProps = {
  showStudio: boolean;
  setShowStudio: (v: boolean) => void;
  tabs: TabState[];
  activeTabId: string | null;
  addTab: () => void;
  renameTab: (id: string, name: string) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  updateTab: (id: string, upd: Partial<TabState>) => void;
};

const VisualizationContext = createContext<VisualizationContextProps | undefined>(undefined);

export const useVisualization = () => {
  const ctx = useContext(VisualizationContext);
  if (!ctx) throw new Error('VisualizationContext must be used within VisualizationProvider');
  return ctx;
};

export const VisualizationProvider = ({ children }: { children: ReactNode }) => {
  const [showStudio, setShowStudio] = useState(false);
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('visualization_state_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        setShowStudio(parsed.showStudio);
        setTabs(parsed.tabs);
        setActiveTabId(parsed.activeTabId);
      }
    } catch { /* ignore corrupt state */ }
  }, []);

  useEffect(() => {
    const payload = { showStudio, tabs, activeTabId };
    localStorage.setItem('visualization_state_v2', JSON.stringify(payload));
  }, [showStudio, tabs, activeTabId]);

  const addTab = () => {
    const newId = Date.now().toString();
    const newTab: TabState = {
      id: newId,
      name: `Sheet ${tabs.length + 1}`,
      datasets: [],
      notes: '',
      graphs: [{ id: `g-${newId}`, chartType: 'bar' }],
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const renameTab = (id: string, name: string) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
  };

  const closeTab = (id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTabId === id) setActiveTabId(tabs.length > 1 ? tabs[0].id : null);
  };

  const selectTab = (id: string) => setActiveTabId(id);

  const updateTab = (id: string, upd: Partial<TabState>) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, ...upd } : t)));
  };

  return (
    <VisualizationContext.Provider
      value={{ showStudio, setShowStudio, tabs, activeTabId, addTab, renameTab, closeTab, selectTab, updateTab }}
    >
      {children}
    </VisualizationContext.Provider>
  );
};

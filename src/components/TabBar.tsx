import type { TabDef } from '../config/types';

interface TabBarProps {
  tabs: TabDef[];
  activeTab: string;
  onTabClick: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabClick }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${tab.id === activeTab ? 'tab-active' : ''} ${!tab.enabled ? 'tab-disabled' : ''}`}
          disabled={!tab.enabled}
          title={tab.tooltip ?? tab.label}
          onClick={() => tab.enabled && onTabClick(tab.id)}
        >
          {tab.label}
          {!tab.enabled && tab.tooltip && (
            <span className="tab-badge">{tab.tooltip}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

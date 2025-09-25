import ReactTooltip from 'react-tooltip';

interface TabNavigationProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation = ({ tabs, activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <>
      <div className="flex bg-card rounded-lg p-1 mb-4 transition-colors duration-300 border border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-300 ${
              activeTab === tab
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
            onClick={() => onTabChange(tab)}
            data-tip={`Switch to ${tab} tab`} // Tooltip text
          >
            {tab}
          </button>
        ))}
      </div>
      <ReactTooltip place="top" type="dark" effect="solid" />
    </>
  );
};

export default TabNavigation;

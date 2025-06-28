interface TabNavigationProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation = ({ tabs, activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-4 transition-colors duration-300">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-300 ${
            activeTab === tab
              ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-300 shadow'
              : 'text-gray-600 dark:text-gray-300 hover:text-teal-500 dark:hover:text-teal-400'
          }`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;

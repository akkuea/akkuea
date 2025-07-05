import React from 'react';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const heatmapData = [
  { month: 'Jan' },
  { month: 'Feb' },
  { month: 'Mar' },
  { month: 'Apr' },
  { month: 'May' },
  { month: 'Jun' },
  { month: 'Jul' },
  { month: 'Aug' },
  { month: 'Sep' },
  { month: 'Oct' },
  { month: 'Nov' },
  { month: 'Dec' },
];

const getActivityColor = (level: number): string => {
  switch (level) {
    case 0:
      return 'bg-gray-200 dark:bg-gray-700';
    case 1:
      return 'bg-teal-100 dark:bg-teal-900';
    case 2:
      return 'bg-teal-300 dark:bg-teal-700';
    case 3:
      return 'bg-teal-500 dark:bg-teal-500';
    case 4:
      return 'bg-teal-700 dark:bg-teal-300';
    default:
      return 'bg-gray-200 dark:bg-gray-700';
  }
};

const AnnualContributions: React.FC = () => {
  return (
    <div className="mb-8 w-full border rounded-xl p-3 shadow-lg dark:border-gray-700 dark:bg-black transition-colors duration-300 overflow-x-auto">
      <h2 className="text-base font-medium mb-4 text-gray-800 dark:text-gray-200">
        Annual Contributions
      </h2>

      <div className="flex" style={{ minWidth: 'fit-content' }}>
        {/* Weekday labels column */}
        <div className="flex flex-col mr-2 pt-8">
          {weekdays.map((day) => (
            <div
              key={day}
              className="h-[10px] flex items-center justify-end text-xs text-gray-500 dark:text-gray-400 mb-[2px]"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Main content area */}
        <div className="flex-1">
          {/* Month labels row */}
          <div className="grid grid-cols-12 gap-[2px] mb-4 text-xs text-gray-500 dark:text-gray-400">
            {heatmapData.map((month) => (
              <div key={month.month} className="text-center">
                {month.month}
              </div>
            ))}
          </div>

          {/* Activity grid */}
          <div className="grid grid-rows-7 gap-[2px] md:ml-16">
            {weekdays.map((_, dayIndex) => (
              <div key={`day-row-${dayIndex}`} className="grid grid-cols-12 gap-[2px]">
                {heatmapData.map((month, monthIndex) => {
                  const pattern = [
                    [2, 0, 2, 2, 2, 0, 2, 2, 0, 2, 0, 2],
                    [2, 0, 2, 2, 0, 2, 0, 0, 0, 2, 2, 2],
                    [0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 4, 0],
                    [0, 4, 0, 0, 4, 0, 4, 4, 4, 0, 0, 0],
                    [2, 0, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0],
                    [0, 2, 0, 0, 2, 0, 2, 0, 0, 2, 2, 0],
                    [2, 0, 2, 0, 0, 2, 0, 2, 2, 0, 0, 2],
                  ];
                  const activityLevel = pattern[dayIndex][monthIndex];
                  return (
                    <div
                      key={`${month.month}-${dayIndex}`}
                      className={`h-[10px] w-[10px] rounded-sm ${getActivityColor(activityLevel)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end mt-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={`legend-${level}`}
                className={`h-[10px] w-[10px] rounded-sm mr-1 ${getActivityColor(level)}`}
              />
            ))}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualContributions; 

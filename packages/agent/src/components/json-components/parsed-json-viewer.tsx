'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';

interface ParsedJsonViewProps {
  data: any;
}

export default function ParsedJsonView({ data }: ParsedJsonViewProps) {
  // Function to render different types of values
  const renderValue = (value: any) => {
    if (value === null)
      return <span className="text-gray-500 italic">null</span>;
    if (value === undefined)
      return <span className="text-gray-500 italic">undefined</span>;

    switch (typeof value) {
      case 'boolean':
        return (
          <Badge
            variant={value ? 'default' : 'outline'}
            className={
              value
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 border-0'
                : 'border-2 border-gray-300 dark:border-gray-600'
            }
          >
            {value.toString()}
          </Badge>
        );
      case 'number':
        return <span className="text-blue-500 font-semibold">{value}</span>;
      case 'string':
        return <span className="text-emerald-500">"{value}"</span>;
      default:
        return <span>{JSON.stringify(value)}</span>;
    }
  };

  // Function to render a key-value pair
  const renderKeyValue = (key: string, value: any, depth = 0, index = 0) => {
    const isObject = value !== null && typeof value === 'object';

    return (
      <motion.div
        key={key}
        className="mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <div className="flex items-start">
          <div className="font-semibold min-w-[150px] mr-3 text-purple-700 dark:text-purple-400">
            {key}:
          </div>
          {!isObject ? (
            <div>{renderValue(value)}</div>
          ) : (
            <div className="flex-1">
              {Array.isArray(value) ? (
                <div className="pl-4 border-l-2 border-purple-200 dark:border-purple-800">
                  {value.map((item, idx) => (
                    <div key={idx} className="mb-3 last:mb-0">
                      {typeof item === 'object' && item !== null ? (
                        <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg shadow-sm">
                          {Object.entries(item).map(([k, v], i) =>
                            renderKeyValue(k, v, depth + 1, i),
                          )}
                        </div>
                      ) : (
                        <div className="py-1">{renderValue(item)}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pl-4 border-l-2 border-purple-200 dark:border-purple-800">
                  {Object.entries(value).map(([k, v], i) =>
                    renderKeyValue(k, v, depth + 1, i),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <ScrollArea className="h-[500px] w-full rounded-xl border-2 border-cyan-100 dark:border-cyan-900/30 p-5 bg-gradient-to-br from-white to-cyan-50 dark:from-gray-800 dark:to-gray-900 shadow-inner">
      <div className="space-y-4">
        {Object.entries(data).map(([key, value], index) =>
          renderKeyValue(key, value, 0, index),
        )}
      </div>
    </ScrollArea>
  );
}

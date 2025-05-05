'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface GraphicalJsonViewProps {
  data: any;
}

interface TreeNodeProps {
  name: string;
  value: any;
  depth?: number;
  isLast?: boolean;
  index?: number;
}

const TreeNode = ({
  name,
  value,
  depth = 0,
  isLast = false,
  index = 0,
}: TreeNodeProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const getValueType = (val: any) => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    return typeof val;
  };

  const getNodeColor = (val: any) => {
    const type = getValueType(val);
    switch (type) {
      case 'string':
        return 'text-emerald-500 dark:text-emerald-400';
      case 'number':
        return 'text-blue-500 dark:text-blue-400';
      case 'boolean':
        return 'text-purple-500 dark:text-purple-400';
      case 'null':
        return 'text-gray-500';
      case 'undefined':
        return 'text-gray-500';
      default:
        return '';
    }
  };

  const getBadgeColor = (val: boolean) => {
    return val
      ? 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 border-0'
      : 'border-2 border-gray-300 dark:border-gray-600';
  };

  const renderValue = (val: any) => {
    const type = getValueType(val);
    const color = getNodeColor(val);

    switch (type) {
      case 'string':
        return <span className={color}>"{val}"</span>;
      case 'boolean':
        return (
          <Badge
            variant={val ? 'default' : 'outline'}
            className={getBadgeColor(val)}
          >
            {val.toString()}
          </Badge>
        );
      case 'null':
        return <span className={color}>null</span>;
      case 'undefined':
        return <span className={color}>undefined</span>;
      default:
        return <span className={color}>{val}</span>;
    }
  };

  const nodeVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.03,
        duration: 0.3,
      },
    }),
  };

  const childVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: {
        duration: 0.3,
        when: 'beforeChildren',
        staggerChildren: 0.05,
      },
    },
  };

  return (
    <motion.div
      className={`ml-${depth > 0 ? 4 : 0}`}
      variants={nodeVariants}
      initial="hidden"
      animate="visible"
      custom={index}
    >
      <div
        className={`flex items-center py-2 px-2 rounded-lg ${
          isObject
            ? 'hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer'
            : ''
        }`}
        onClick={() => isObject && setIsOpen(!isOpen)}
      >
        {isObject ? (
          <motion.div
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="mr-1 flex items-center justify-center w-5 h-5 bg-gradient-to-br from-green-400 to-teal-500 rounded-full text-white"
          >
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </motion.div>
        ) : (
          <span className="w-5"></span>
        )}

        <span className="font-semibold mr-2 text-purple-700 dark:text-purple-400">
          {name}
        </span>

        {isObject ? (
          <Badge className="bg-gradient-to-r from-indigo-400 to-purple-500 border-0 text-white">
            {isArray ? 'Array' : 'Object'}
            <span className="ml-1 text-xs opacity-80">
              ({isArray ? value.length : Object.keys(value).length})
            </span>
          </Badge>
        ) : (
          renderValue(value)
        )}
      </div>

      <AnimatePresence>
        {isOpen && isObject && (
          <motion.div
            variants={childVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="border-l-2 border-teal-300 dark:border-teal-700 pl-4 ml-2"
          >
            {isArray
              ? value.map((item: any, idx: number) => (
                  <TreeNode
                    key={idx}
                    name={`[${idx}]`}
                    value={item}
                    depth={depth + 1}
                    isLast={idx === value.length - 1}
                    index={idx}
                  />
                ))
              : Object.entries(value).map(([key, val], idx, arr) => (
                  <TreeNode
                    key={key}
                    name={key}
                    value={val}
                    depth={depth + 1}
                    isLast={idx === arr.length - 1}
                    index={idx}
                  />
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function GraphicalJsonView({ data }: GraphicalJsonViewProps) {
  return (
    <ScrollArea className="h-[500px] w-full rounded-xl border-2 border-teal-100 dark:border-teal-900/30 p-5 bg-gradient-to-br from-white to-teal-50 dark:from-gray-800 dark:to-gray-900 shadow-inner">
      <div className="space-y-1">
        {Object.entries(data).map(([key, value], index, arr) => (
          <TreeNode
            key={key}
            name={key}
            value={value}
            isLast={index === arr.length - 1}
            index={index}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

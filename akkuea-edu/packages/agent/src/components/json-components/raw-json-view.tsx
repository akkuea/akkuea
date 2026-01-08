'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface RawJsonViewProps {
  data: any;
}

export default function RawJsonView({ data }: RawJsonViewProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Function to colorize JSON syntax
  const colorizeJson = (json: string) => {
    return json
      .replace(/"([^"]+)":/g, '<span class="text-pink-500">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="text-green-500">"$1"</span>')
      .replace(/: (\d+)/g, ': <span class="text-blue-500">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-purple-500">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');
  };

  return (
    <div className="relative">
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="sm"
          variant="outline"
          className="absolute right-3 top-3 h-8 w-8 p-0 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm shadow-md border-2 border-purple-200 dark:border-purple-800 rounded-full z-10"
          onClick={copyToClipboard}
        >
          {copied ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <CheckIcon className="h-4 w-4 text-green-500" />
            </motion.div>
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
        </Button>
      </motion.div>

      <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-xl overflow-auto max-h-[500px] text-sm font-mono shadow-inner border border-purple-100 dark:border-purple-900/50">
        <pre
          className="language-json"
          dangerouslySetInnerHTML={{
            __html: colorizeJson(jsonString),
          }}
        />
      </div>
    </div>
  );
}

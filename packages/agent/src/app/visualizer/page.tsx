'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import RawJsonView from '@/components/json-components/raw-json-view';

import { FileJson, FileText, GitBranchPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ParsedJsonView from '@/components/json-components/parsed-json-viewer';
import GraphicalJsonView from '@/components/json-components/graphical-json-viewer';
import ReactToolTip from 'react-tooltip';

// Sample JSON files for demonstration
const sampleFiles = {
  'personality.json': {
    name: 'AI Assistant',
    personality: {
      traits: ['helpful', 'friendly', 'knowledgeable'],
      tone: 'professional',
      style: 'conversational',
    },
    capabilities: [
      { name: 'Answer questions', enabled: true },
      { name: 'Generate content', enabled: true },
      { name: 'Translate text', enabled: true },
    ],
    limitations: ['Cannot access the internet', 'Cannot run code'],
  },
  'config.json': {
    version: '1.0.0',
    settings: {
      theme: 'dark',
      fontSize: 14,
      autoSave: true,
      notifications: {
        enabled: true,
        sound: false,
      },
    },
    plugins: [
      { id: 'syntax-highlighter', active: true },
      { id: 'auto-formatter', active: false },
    ],
  },
  'data.json': {
    users: [
      { id: 1, name: 'John Doe', role: 'admin', active: true },
      { id: 2, name: 'Jane Smith', role: 'editor', active: true },
      { id: 3, name: 'Bob Johnson', role: 'viewer', active: false },
    ],
    statistics: {
      totalUsers: 3,
      activeUsers: 2,
      lastUpdated: '2023-04-15T10:30:00Z',
    },
  },
};

const viewOptions = [
  {
    id: 'raw',
    label: 'Raw JSON',
    icon: FileJson,
    color: 'from-pink-500 to-violet-500',
  },
  {
    id: 'parsed',
    label: 'Parsed JSON',
    icon: FileText,
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'graphical',
    label: 'Graphical View',
    icon: GitBranchPlus,
    color: 'from-green-400 to-teal-500',
  },
];

export default function VisualizerPage() {
  const [selectedFile, setSelectedFile] = useState<string>('personality.json');
  const [activeView, setActiveView] = useState<string>('raw');
  const [mounted, setMounted] = useState(false);
  const jsonData = sampleFiles[selectedFile as keyof typeof sampleFiles];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                data-tip="Go back to homepage" // <-- added tooltip
                className="flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>

          <h1 className="text-4xl font-bold bg-clip-text text-[##7CC635]">
            JSON Visualizer
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Explore and visualize JSON data in multiple beautiful formats
          </p>

          <div className="w-full max-w-md">
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger className="w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-purple-200 dark:border-purple-900 rounded-xl shadow-md">
                <SelectValue placeholder="Select a file" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-purple-200 dark:border-purple-900">
                {Object.keys(sampleFiles).map((filename) => (
                  <SelectItem
                    key={filename}
                    value={filename}
                    className="focus:bg-purple-100 dark:focus:bg-purple-900/30"
                  >
                    {filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg">
              {viewOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={activeView === option.id ? 'default' : 'ghost'}
                  data-tip={option.label} // <-- added tooltip
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg ${
                    activeView === option.id
                      ? `bg-gradient-to-r ${option.color} text-white`
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveView(option.id)}
                >
                  <option.icon className="h-4 w-4" />
                  <span>{option.label}</span>
                  {activeView === option.id && (
                    <motion.span
                      layoutId="activeIndicator"
                      className="absolute inset-0 rounded-lg"
                      initial={false}
                      transition={{ type: 'spring', duration: 0.5 }}
                    />
                  )}
                </Button>
              ))}
              <ReactToolTip place="top" type="dark" />{' '}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl rounded-2xl">
                <CardContent className="p-6">
                  {activeView === 'raw' && <RawJsonView data={jsonData} />}
                  {activeView === 'parsed' && (
                    <ParsedJsonView data={jsonData} />
                  )}
                  {activeView === 'graphical' && (
                    <GraphicalJsonView data={jsonData} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-sm text-gray-500 dark:text-gray-400"
        >
          <p>
            Select a file and visualization method to explore your JSON data
          </p>
        </motion.div>
      </div>
    </div>
  );
}

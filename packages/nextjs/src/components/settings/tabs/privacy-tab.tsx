'use client';

import { useState } from 'react';
import { Lock, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';


export interface FilterOption {
  id: string;
  label: string;
}

export function PrivacyTab() {
  const [privateProfile, setPrivateProfile] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [contentFilter, setContentFilter] = useState('moderate');
  // const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Handlers
  const handleViewPrivacyPolicy = () => window.open('/privacy-policy', '_blank');
  const handleDownloadData = () => console.log('Downloading user data...');
  // const handleDeleteAccount = () => {
  //   console.log('Account deleted');
  //   setShowDeleteModal(false);
  // };

  const filterOptions: FilterOption[] = [
    { id: 'off', label: 'Off - Show all content' },
    { id: 'moderate', label: 'Moderate - Hide potentially sensitive content' },
    { id: 'strict', label: 'Strict - Only show content from people you follow' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-teal-500 dark:text-teal-400">
          <Lock className="w-5 h-5" />
        </span>
        <h2 className="text-lg font-semibold">Privacy & Security</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 ml-0 sm:ml-7">
        Control your privacy and security preferences
      </p>

      <div className="ml-0 sm:ml-7 space-y-6">
        {/* Private Profile */}
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Private Profile</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Only approved followers can see your posts
            </p>
          </div>
          <Switch
            checked={privateProfile}
            onCheckedChange={setPrivateProfile}
          />
        </div>

        {/* Online Status */}
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Show Online Status</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Let others see when you&apos;re active
            </p>
          </div>
          <Switch
            checked={showOnlineStatus}
            onCheckedChange={setShowOnlineStatus}
          />
        </div>

        {/* Content Filtering */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Content Filtering</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Control what type of content you see
          </p>
          <div className="space-y-3">
            {filterOptions.map((option) => (
              <label key={option.id} className="flex items-center">
                <input
                  type="radio"
                  name="filtering"
                  value={option.id}
                  checked={contentFilter === option.id}
                  onChange={() => setContentFilter(option.id)}
                  className="form-radio h-4 w-4 text-teal-500 dark:text-teal-400"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center">
            <FileText className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Privacy Policy</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">View our privacy policy</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleViewPrivacyPolicy}>
            View
          </Button>
        </div>

        {/* Download Data */}
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center">
            <Download className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Download Your Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Get a copy of your data</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleDownloadData}>
            Download
          </Button>
        </div>

        {/* Delete Account */}
        <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/10">
          <div>
            <h3 className="font-medium text-red-600 dark:text-red-400">Delete Account</h3>
            <p className="text-sm text-red-500 dark:text-red-400">
              Permanently delete your account and all data
            </p>
          </div>
          <Button 
            variant="destructive" 
            onClick={() => {}}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Lock, FileText, Download } from 'lucide-react';
import { SectionContainer, SectionTitle, SectionDescription } from './section-components';
import { ToggleSwitch } from './toggle-switch';
import { ActionButton } from './action-button';
import { DeleteAccountModal } from './delete-account-modal';

export interface PrivacyTabProps {
  isDarkMode: boolean;
}

export interface FilterOption {
  id: string;
  label: string;
}

export function PrivacyTab({ isDarkMode }: PrivacyTabProps) {
  const [privateProfile, setPrivateProfile] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [contentFilter, setContentFilter] = useState('moderate');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Handlers
  const handleViewPrivacyPolicy = () => window.open('/privacy-policy', '_blank');
  const handleDownloadData = () => console.log('Downloading user data...');
  const handleDeleteAccount = () => {
    console.log('Account deleted');
    setShowDeleteModal(false);
  };

  const filterOptions: FilterOption[] = [
    { id: 'off', label: 'Off - Show all content' },
    { id: 'moderate', label: 'Moderate - Hide potentially sensitive content' },
    { id: 'strict', label: 'Strict - Only show content from people you follow' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center mb-2">
        <Lock
          className={isDarkMode ? 'w-6 h-6 mr-2 text-teal-400' : 'w-6 h-6 mr-2 text-teal-600'}
        />
        <h1
          className={
            isDarkMode ? 'text-2xl font-bold text-teal-400' : 'text-2xl font-bold text-teal-700'
          }
        >
          Privacy Settings
        </h1>
      </div>
      <SectionDescription
        text="Control your privacy and security preferences"
        isDarkMode={isDarkMode}
      />
      <div className="mb-8"></div>

      <SectionContainer>
        <div className="flex justify-between items-center mb-1">
          <SectionTitle title="Private Profile" isDarkMode={isDarkMode} />
          <ToggleSwitch
            isChecked={privateProfile}
            onChange={() => setPrivateProfile(!privateProfile)}
          />
        </div>
        <SectionDescription
          text="Only approved followers can see your posts"
          isDarkMode={isDarkMode}
        />
      </SectionContainer>

      {/* Online Status */}
      <SectionContainer>
        <div className="flex justify-between items-center mb-1">
          <SectionTitle title="Show Online Status" isDarkMode={isDarkMode} />
          <ToggleSwitch
            isChecked={showOnlineStatus}
            onChange={() => setShowOnlineStatus(!showOnlineStatus)}
          />
        </div>
        <SectionDescription text="Let others see when you're active" isDarkMode={isDarkMode} />
      </SectionContainer>

      {/* Content Filtering */}
      <SectionContainer>
        <SectionTitle title="Content Filtering" isDarkMode={isDarkMode} />
        <SectionDescription text="Control what type of content you see" isDarkMode={isDarkMode} />

        <div className="mt-4 space-y-3">
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
              <span className={`ml-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </SectionContainer>

      {/* Privacy Policy */}
      <SectionContainer>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <FileText
              className={isDarkMode ? 'w-5 h-5 mr-2 text-gray-400' : 'w-5 h-5 mr-2 text-gray-600'}
            />
            <div>
              <SectionTitle title="Privacy Policy" isDarkMode={isDarkMode} />
              <SectionDescription text="View our privacy policy" isDarkMode={isDarkMode} />
            </div>
          </div>
          <ActionButton label="View" onClick={handleViewPrivacyPolicy} isDarkMode={isDarkMode} />
        </div>
      </SectionContainer>

      {/* Download Data */}
      <SectionContainer>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Download
              className={isDarkMode ? 'w-5 h-5 mr-2 text-gray-400' : 'w-5 h-5 mr-2 text-gray-600'}
            />
            <div>
              <SectionTitle title="Download Your Data" isDarkMode={isDarkMode} />
              <SectionDescription text="Get a copy of your data" isDarkMode={isDarkMode} />
            </div>
          </div>
          <ActionButton label="Download" onClick={handleDownloadData} isDarkMode={isDarkMode} />
        </div>
      </SectionContainer>

      {/* Delete Account */}
      <SectionContainer hasBorder={false}>
        <div className="flex justify-between items-center">
          <div>
            <h2
              className={
                isDarkMode
                  ? 'text-lg font-semibold text-red-400'
                  : 'text-lg font-semibold text-red-600'
              }
            >
              Delete Account
            </h2>
            <SectionDescription text="Permanently delete your account" isDarkMode={isDarkMode} />
          </div>
          <ActionButton
            label="Delete"
            onClick={() => setShowDeleteModal(true)}
            isDarkMode={isDarkMode}
            isDanger={true}
          />
        </div>
      </SectionContainer>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          isDarkMode={isDarkMode}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}

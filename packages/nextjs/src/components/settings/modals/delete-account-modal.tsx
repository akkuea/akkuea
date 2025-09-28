import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DeleteAccountModalProps {
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ isDarkMode, onCancel, onConfirm }: DeleteAccountModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={
          isDarkMode
            ? 'bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 mx-4'
            : 'bg-white rounded-lg shadow-lg max-w-md w-full p-6 mx-4'
        }
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <AlertTriangle
              className={isDarkMode ? 'w-6 h-6 mr-2 text-red-400' : 'w-6 h-6 mr-2 text-red-600'}
            />
            <h3
              className={
                isDarkMode ? 'text-xl font-bold text-red-400' : 'text-xl font-bold text-red-600'
              }
            >
              Delete Account
            </h3>
          </div>
          <button
            onClick={onCancel}
            className={
              isDarkMode ? 'text-gray-200 hover:text-red-400' : 'text-gray-800 hover:text-red-600'
            }
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className={isDarkMode ? 'text-gray-200 mb-4' : 'text-gray-800 mb-4'}>
            Are you sure you want to delete your account? This action cannot be undone.
          </p>
          <ul
            className={
              isDarkMode
                ? 'text-gray-400 list-disc list-inside space-y-2'
                : 'text-gray-600 list-disc list-inside space-y-2'
            }
          >
            <li>All your data will be permanently deleted</li>
            <li>You will lose access to all your content</li>
            <li>Your username will be released and may become available to others</li>
          </ul>
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

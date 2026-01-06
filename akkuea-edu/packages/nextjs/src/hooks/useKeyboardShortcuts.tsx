import { useHotkeys } from 'react-hotkeys-hook';
import { defaultShortcuts, getShortcutKeys, type ShortcutAction } from '@/utils/shortcuts';
import { toast } from 'sonner';

interface UseKeyboardShortcutsProps {
  onHelp: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onNewFile?: () => void;
  onToggleFullscreen?: () => void;
  customActions?: ShortcutAction[];
}

export const useKeyboardShortcuts = ({
  onHelp,
  onSave,
  onSearch,
  onNewFile,
  onToggleFullscreen,
  customActions = [],
}: UseKeyboardShortcutsProps) => {
  // Help shortcut
  useHotkeys(
    getShortcutKeys(defaultShortcuts.help),
    (e) => {
      e.preventDefault();
      onHelp();
    },
    { enableOnContentEditable: false }
  );

  // Save shortcut
  useHotkeys(
    getShortcutKeys(defaultShortcuts.save),
    (e) => {
      e.preventDefault();
      if (onSave) {
        onSave();
      } else {
        toast('Save', {
          description: 'Save functionality not implemented yet',
        });
      }
    },
    { enableOnContentEditable: false }
  );

  // Search shortcut
  useHotkeys(
    getShortcutKeys(defaultShortcuts.search),
    (e) => {
      e.preventDefault();
      if (onSearch) {
        onSearch();
      } else {
        toast('Search', {
          description: 'Search functionality not implemented yet',
        });
      }
    },
    { enableOnContentEditable: false }
  );

  // New file shortcut
  useHotkeys(
    getShortcutKeys(defaultShortcuts.newFile),
    (e) => {
      e.preventDefault();
      if (onNewFile) {
        onNewFile();
      } else {
        toast('New File', {
          description: 'New file functionality not implemented yet',
        });
      }
    },
    { enableOnContentEditable: false }
  );

  useHotkeys(
    getShortcutKeys(defaultShortcuts.toggleFullscreen),
    (e) => {
      e.preventDefault();
      if (onToggleFullscreen) {
        onToggleFullscreen();
      } else {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    },
    { enableOnContentEditable: false }
  );

  useHotkeys(
    customActions.flatMap((action) => action.keys),
    (e, handler) => {
      e.preventDefault();
      const pressed = handler.keys?.join('+') ?? '';
      const matched = customActions.find((a) => a.keys.includes(pressed));
      matched?.action();
    },
    { enableOnContentEditable: false },
    [customActions]
  );

  return null;
};

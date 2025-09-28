export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  keys: string[];
  macKeys?: string[];
  category: 'navigation' | 'editing' | 'view' | 'help';
  action: () => void;
}

export interface ShortcutConfig {
  [key: string]: {
    keys: string[];
    macKeys?: string[];
    description: string;
    category: 'navigation' | 'editing' | 'view' | 'help';
  };
}

export const isMac =
  typeof navigator !== 'undefined' ? navigator.platform.toUpperCase().indexOf('MAC') >= 0 : false;

// Default keyboard shortcuts configuration
export const defaultShortcuts: ShortcutConfig = {
  save: {
    keys: ['ctrl+s'],
    macKeys: ['cmd+s'],
    description: 'Save current work',
    category: 'editing',
  },
  help: {
    keys: ['ctrl+/'],
    macKeys: ['cmd+/'],
    description: 'Show keyboard shortcuts help',
    category: 'help',
  },
  search: {
    keys: ['ctrl+k'],
    macKeys: ['cmd+k'],
    description: 'Open search',
    category: 'navigation',
  },
  newFile: {
    keys: ['ctrl+n'],
    macKeys: ['cmd+n'],
    description: 'Create new file',
    category: 'editing',
  },
  copy: {
    keys: ['ctrl+c'],
    macKeys: ['cmd+c'],
    description: 'Copy selection',
    category: 'editing',
  },
  paste: {
    keys: ['ctrl+v'],
    macKeys: ['cmd+v'],
    description: 'Paste from clipboard',
    category: 'editing',
  },
  undo: {
    keys: ['ctrl+z'],
    macKeys: ['cmd+z'],
    description: 'Undo last action',
    category: 'editing',
  },
  redo: {
    keys: ['ctrl+shift+z'],
    macKeys: ['cmd+shift+z'],
    description: 'Redo last undone action',
    category: 'editing',
  },
  closeModal: {
    keys: ['escape'],
    macKeys: ['escape'],
    description: 'Close modal or dialog',
    category: 'navigation',
  },
  toggleFullscreen: {
    keys: ['f11'],
    macKeys: ['cmd+ctrl+f'],
    description: 'Toggle fullscreen mode',
    category: 'view',
  },
};

export const formatShortcut = (keys: string[]): string => {
  const platformKeys = isMac && keys.length > 1 ? keys : keys;
  return platformKeys[0]
    .split('+')
    .map((key) => {
      const keyMap: { [key: string]: string } = {
        ctrl: isMac ? '⌃' : 'Ctrl',
        cmd: '⌘',
        shift: isMac ? '⇧' : 'Shift',
        alt: isMac ? '⌥' : 'Alt',
        escape: 'Esc',
        enter: 'Enter',
        space: 'Space',
        tab: 'Tab',
        backspace: 'Backspace',
        delete: 'Delete',
        '/': '/',
        k: 'K',
        s: 'S',
        n: 'N',
        c: 'C',
        v: 'V',
        z: 'Z',
        f11: 'F11',
      };
      return keyMap[key.toLowerCase()] || key.toUpperCase();
    })
    .join(isMac ? '' : '+');
};

export const getShortcutKeys = (shortcut: ShortcutConfig[string]): string[] => {
  return isMac && shortcut.macKeys ? shortcut.macKeys : shortcut.keys;
};

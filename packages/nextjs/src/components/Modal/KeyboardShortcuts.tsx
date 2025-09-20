import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  defaultShortcuts,
  formatShortcut,
  getShortcutKeys,
  type ShortcutAction,
} from '@/utils/shortcuts';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  customActions?: ShortcutAction[];
}

const KeyboardShortcuts = ({ isOpen, onClose, customActions = [] }: KeyboardShortcutsProps) => {
  const categories = {
    navigation: 'Navigation',
    editing: 'Editing',
    view: 'View',
    help: 'Help',
  };

  const allShortcuts = [
    ...Object.entries(defaultShortcuts).map(([id, shortcut]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1'),
      description: shortcut.description,
      keys: getShortcutKeys(shortcut),
      category: shortcut.category,
    })),
    ...customActions,
  ];

  const groupedShortcuts = allShortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, typeof allShortcuts>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-modal">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-accent"
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>
        </DialogHeader>

        <div className="grid gap-6 max-h-96 overflow-y-auto pr-2">
          {Object.entries(categories).map(([categoryKey, categoryName]) => {
            const shortcuts = groupedShortcuts[categoryKey as keyof typeof categories];
            if (!shortcuts?.length) return null;

            return (
              <div key={categoryKey} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {categoryName}
                </h3>
                <div className="grid gap-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{shortcut.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {shortcut.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {formatShortcut(shortcut.keys)
                          .split('+')
                          .map((key, index, array) => (
                            <div key={index} className="flex items-center">
                              <Badge
                                variant="secondary"
                                className="px-2 py-1 text-xs font-mono bg-shortcut-key-bg text-shortcut-key border border-shortcut-separator"
                              >
                                {key}
                              </Badge>
                              {index < array.length - 1 && (
                                <span className="mx-1 text-shortcut-separator">+</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press{' '}
            <Badge variant="outline" className="mx-1 text-xs">
              Esc
            </Badge>{' '}
            or click outside to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcuts;

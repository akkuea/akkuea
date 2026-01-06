'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import KeyboardShortcuts from '@/components/Modal/KeyboardShortcuts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';
import { toast } from 'sonner';

const ShortcutPage = () => {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onHelp: () => setIsShortcutsOpen(true),
    onSave: () =>
      toast.success('File Saved', {
        description: 'Your work has been saved successfully',
      }),
    onSearch: () =>
      toast.info('Search', {
        description: 'Opening search functionality...',
      }),
    onNewFile: () =>
      toast('New File', {
        description: 'Creating a new file...',
      }),
  });

  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="flex items-center justify-center gap-4">
        <Button
          onClick={() => setIsShortcutsOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-full font-semibold transition-all transform hover:scale-105 shadow-lg"
        >
          <Keyboard className="h-5 w-5 mr-2" />
          View All Shortcuts
        </Button>
      </div>

      <KeyboardShortcuts isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
};

export default ShortcutPage;

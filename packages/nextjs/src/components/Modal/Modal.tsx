'use client';

import React from 'react';
import { useModalStore } from '@/store/useModalStore';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '../ui/dialog';
import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import

export const Modal = () => {
  const { isOpen, view, onClose } = useModalStore();

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose?.()}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Button
            variant="ghost"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            onClick={() => onClose?.()}
            data-tip="Close modal"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          {view}
          <ReactTooltip place="top" effect="solid" /> {/* ✅ global tooltip */}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

import { create } from 'zustand';
import { ReactNode } from 'react';

interface ModalStore {
  isOpen: boolean;
  view: ReactNode | null;
  onClose?: () => void;
  onOpen: (view: ReactNode, onClose?: () => void) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  isOpen: false,
  view: null,
  onOpen: (view: ReactNode, onClose?: () => void) => {
    set({ isOpen: true, view, onClose });
  },
}));

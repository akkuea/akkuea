import { ReactNode } from 'react';
import { create } from 'zustand';

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

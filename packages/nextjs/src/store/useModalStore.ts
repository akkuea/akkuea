import { create } from 'zustand';

interface ModalStore {
  isOpen: boolean;
  content: any | null;
  openModal: (content: any) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  isOpen: false,
  content: null,
  openModal: (content) => set({ isOpen: true, content }),
  closeModal: () => set({ isOpen: false, content: null }),
}));

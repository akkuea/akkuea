'use client';

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalStore } from '@/store/useModalStore';
import { X } from 'lucide-react';
import { Button } from '../ui/button';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { scale: 0.95, opacity: 0, y: 20 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      duration: 0.5,
      bounce: 0.3,
    },
  },
  exit: {
    scale: 0.95,
    opacity: 0,
    y: 20,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

export const Modal = () => {
  const { isOpen, content, closeModal } = useModalStore();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    },
    [closeModal]
  );

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto absolute top-[1rem] right-[1rem] rounded-[50%]"
          onClick={closeModal}
        >
          <X className="h-6 w-6" />
        </Button>
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: 'relative',
            width: '100%',
            overflow: 'auto',
            maxHeight: '90vh',
          }}
        >
          <div onClick={handleContentClick}>{content}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

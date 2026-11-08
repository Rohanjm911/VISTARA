import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { uiSound } from '../utils/uiSound';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        uiSound.play('modalOpen');
      }
    } else {
      if (dialog.open) {
        dialog.close();
        uiSound.play('modalClose');
      }
    }
  }, [isOpen]);

  // Modern Web Guidance: fallback for light-dismiss on backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (!isDialogContent) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as unknown as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className={`bg-[#12151b] text-[#f3f4f6] rounded-lg border border-[#242a36] shadow-2xl p-0 w-full ${maxWidth} backdrop:bg-black/80 m-auto focus:outline-none overflow-hidden`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#242a36] bg-[#181c24]">
        {title && <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>}
        <button
          onClick={onClose}
          className="p-1 rounded text-[#9ca3af] hover:text-white hover:bg-[#242a36] transition-colors ml-auto"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
    </dialog>
  );
};


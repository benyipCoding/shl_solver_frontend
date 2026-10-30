"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function ModalFrame({
  open,
  onClose,
  busy = false,
  drawer = false,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  drawer?: boolean;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = ref.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={`${drawer ? "inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl rounded-none" : "inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-2xl"} fixed overflow-y-auto bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40 dark:bg-slate-900 dark:text-slate-100`}
    >
      {children}
    </dialog>
  );
}

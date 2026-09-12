'use client';

import { useEffect, type RefObject } from 'react';
import { toast } from 'react-toastify';

export function useTopLayer(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.showPopover !== 'function') return;

    const raise = () => {
      if (element.matches(':popover-open')) element.hidePopover();
      element.showPopover();
    };

    raise();

    return toast.onChange((item) => {
      if (item.status === 'added') raise();
    });
  }, [ref]);
}

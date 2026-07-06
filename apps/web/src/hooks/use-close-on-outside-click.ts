'use client';

import { useEffect, type RefObject } from 'react';

type UseCloseOnOutsideClickOptions = {
  enabled?: boolean;
  onOutsideClick: () => void;
  refs: Array<RefObject<Element | null>>;
};

export function useCloseOnOutsideClick({
  refs,
  onOutsideClick,
  enabled = true,
}: UseCloseOnOutsideClickOptions) {
  useEffect(() => {
    const activeRefs = refs.filter((ref) => ref.current);
    if (!enabled || activeRefs.length === 0) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const clickedInsideTrackedElement = activeRefs.some((ref) =>
        ref.current?.contains(event.target as Node),
      );

      if (!clickedInsideTrackedElement) {
        onOutsideClick();
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [enabled, onOutsideClick, refs]);
}

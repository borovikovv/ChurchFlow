export const BILLING_SECTION_ID = 'billing';

const HIGHLIGHT_CLASS = 'section-highlight';

/**
 * Brings the billing section into view and pulses a ring around it, so a member who followed
 * the read-only banner sees exactly where to pay. Returns false when the section is not
 * rendered, which lets callers fall back to plain navigation.
 */
export function highlightBillingSection(): boolean {
  const section = document.getElementById(BILLING_SECTION_ID);

  if (!section) {
    return false;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

  // Restart the animation when the banner button is clicked again mid-pulse.
  section.classList.remove(HIGHLIGHT_CLASS);
  void section.offsetWidth;
  section.classList.add(HIGHLIGHT_CLASS);
  section.addEventListener('animationend', () => section.classList.remove(HIGHLIGHT_CLASS), {
    once: true,
  });

  return true;
}

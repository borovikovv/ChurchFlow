export function StatusBadge({ label, status }: { label?: string; status: string }) {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  return <span className={`status-badge status-${normalized}`}>{label ?? status}</span>;
}

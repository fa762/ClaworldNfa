export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={active ? 'status-alive' : 'status-dormant'}>
      {active ? '● ALIVE' : '○ DORMANT'}
    </span>
  );
}

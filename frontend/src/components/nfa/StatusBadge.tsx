export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
      active
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-gray-500/10 text-gray-500 border border-gray-600/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        active ? 'bg-green-400 animate-pulse-dot' : 'bg-gray-600'
      }`} />
      {active ? 'ALIVE' : 'DORMANT'}
    </span>
  );
}

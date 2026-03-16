export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
      active
        ? 'bg-green-900/50 text-green-400 border border-green-700'
        : 'bg-gray-800 text-gray-500 border border-gray-700'
    }`}>
      {active ? 'ALIVE' : 'DORMANT'}
    </span>
  );
}

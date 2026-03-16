export const EVENT_FLAGS = {
  BUBBLE: 1n,
  WINTER: 2n,
  GOLDEN_AGE: 4n,
} as const;

export const EVENT_NAMES: Record<string, { name: string; nameCN: string; color: string }> = {
  BUBBLE: { name: 'Bubble', nameCN: '泡沫', color: 'text-red-400' },
  WINTER: { name: 'Winter', nameCN: '寒冬', color: 'text-blue-400' },
  GOLDEN_AGE: { name: 'Golden Age', nameCN: '繁荣', color: 'text-yellow-400' },
};

export function parseActiveEvents(flags: bigint): string[] {
  const events: string[] = [];
  for (const [key, bit] of Object.entries(EVENT_FLAGS)) {
    if (flags & bit) {
      events.push(key);
    }
  }
  return events;
}

export function getEventInfo(eventKey: string) {
  return EVENT_NAMES[eventKey];
}

const socials = [
  { label: 'X', href: 'https://x.com/ClaworldNfa' },
  { label: 'TG', href: 'https://t.me/ClaworldNfa' },
  { label: 'GH', href: 'https://github.com/fa762/ClaworldNfa' },
];

export function SocialLinks() {
  return (
    <div className="flex items-center gap-1 text-xs">
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="term-link px-1.5 py-0.5 hover:text-crt-bright"
        >
          [{s.label}]
        </a>
      ))}
    </div>
  );
}

import { MessageCircle, Twitter, Github } from 'lucide-react';

const socials = [
  { icon: MessageCircle, label: 'Telegram', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Github, label: 'GitHub', href: '#' },
];

export function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-abyss-orange hover:border-abyss-orange/20 hover:bg-abyss-orange/[0.06] transition-all"
          aria-label={s.label}
        >
          <s.icon size={16} />
        </a>
      ))}
    </div>
  );
}

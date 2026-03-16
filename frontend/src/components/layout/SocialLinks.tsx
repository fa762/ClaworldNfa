import { MessageCircle, Twitter, Github } from 'lucide-react';

const socials = [
  { icon: MessageCircle, label: 'Telegram', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Github, label: 'GitHub', href: '#' },
];

export function SocialLinks() {
  return (
    <div className="flex items-center gap-4">
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-abyss-orange transition-colors"
          aria-label={s.label}
        >
          <s.icon size={20} />
        </a>
      ))}
    </div>
  );
}

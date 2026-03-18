interface TerminalBoxProps {
  title?: string;
  children: React.ReactNode;
  bright?: boolean;
  className?: string;
}

export function TerminalBox({ title, children, bright, className = '' }: TerminalBoxProps) {
  return (
    <div
      className={`term-box ${bright ? 'term-box-bright' : ''} ${className}`}
      data-title={title}
    >
      {children}
    </div>
  );
}

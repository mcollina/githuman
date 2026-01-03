/**
 * GitHuman Logo - A stylized eye merged with a git branch symbol
 * Represents human oversight of code changes
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 48, text: 'text-3xl' },
};

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.svg"
        alt="GitHuman logo"
        width={icon}
        height={icon}
        className="shrink-0"
      />

      {showText && (
        <span className={`font-bold tracking-tight ${text}`}>
          <span className="text-[var(--gh-accent-primary)]">Git</span>
          <span className="text-[var(--gh-text-primary)]">Human</span>
        </span>
      )}
    </div>
  );
}

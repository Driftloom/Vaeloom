import React from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  fallback?: string;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ src, alt, size = 'md', fallback, className = '' }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const showImg = src && !imgError;
  const initials = fallback ?? getInitials(alt);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-surface-active text-text-muted font-medium shrink-0 ${sizeClasses[size]} ${className}`}
      aria-label={alt}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

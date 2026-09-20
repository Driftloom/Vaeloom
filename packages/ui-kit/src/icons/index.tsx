import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  color?: string;
}

const defaultProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ChevronDownIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

export const BrainIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M12 5v13" />
  </svg>
);

export const CpuIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2M9 2v2M20 15h2M20 9h2M9 20v2M15 20v2M2 9h2M2 15h2" />
  </svg>
);

export const DatabaseIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const BellIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const RefreshCwIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const AlertCircleIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" x2="12" y1="9" y2="13" />
    <line x1="12" x2="12.01" y1="17" y2="17" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M5 12h14M12 5v14" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const MoreVerticalIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

export const MoreHorizontalIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

export const FileTextIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8M16 13H8M16 17H8" />
  </svg>
);

export const BriefcaseIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M8 2v4M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const PlugIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </svg>
);

export const BuildingIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </svg>
);

export const TerminalIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" x2="20" y1="19" y2="19" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const LogOutIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const KeyIcon: React.FC<IconProps> = ({ size = 16, className = '', color, ...props }) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({
  size = 16,
  className = '',
  color,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    {...defaultProps}
    stroke={color || 'currentColor'}
    className={className}
    {...props}
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
  </svg>
);

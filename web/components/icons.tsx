import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7" height="8" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="11" width="7" height="10" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const VehiclesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 16.5h14M4 16.5v2.2a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8v-2.2M16.8 16.5v2.2a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8v-2.2" />
    <path d="M4 16.5v-3.1l1.7-4.6A2 2 0 0 1 7.6 7.5h8.8a2 2 0 0 1 1.9 1.3l1.7 4.6v3.1" />
    <path d="M6.5 13.2h2.2M15.3 13.2h2.2" />
  </Icon>
);

export const TradeInsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8.5h13l-2.6-2.7M20 15.5H7l2.6 2.7" />
  </Icon>
);

export const LeadsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 6.5h17v11h-17z" />
    <path d="m3.9 7.2 8.1 5.6 8.1-5.6" />
  </Icon>
);

export const CrmIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a5.7 5.7 0 0 1 11 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.5 15.2a5.7 5.7 0 0 1 3 4.3" />
  </Icon>
);

export const ReportsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 19.5V4.5M4 19.5h16" />
    <path d="M8 16.5v-4.8M12.5 16.5V7.8M17 16.5v-6.6" />
  </Icon>
);

export const IntegrationsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.5 6.5 8 4a2.6 2.6 0 0 0-3.7 3.7l2.5 2.5" />
    <path d="m13.5 17.5 2.5 2.5a2.6 2.6 0 0 0 3.7-3.7l-2.5-2.5" />
    <path d="m9.3 14.7 5.4-5.4" />
  </Icon>
);

export const StaffIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
  </Icon>
);

export const SaasIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 18.5a3.8 3.8 0 0 1-.4-7.6 5.2 5.2 0 0 1 10-1.4 3.9 3.9 0 0 1-.6 9z" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19.1 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.5-1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.5h.2a1.8 1.8 0 1 1 0 3.6h-.3a1.5 1.5 0 0 0-1.4 1z" />
  </Icon>
);

export const PlatformIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5z" />
  </Icon>
);

export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 8.2V6.5a1.8 1.8 0 0 0-1.8-1.8H6.3A1.8 1.8 0 0 0 4.5 6.5v11a1.8 1.8 0 0 0 1.8 1.8h6.4a1.8 1.8 0 0 0 1.8-1.8v-1.7" />
    <path d="M9.8 12h9.7m0 0-2.7-2.7M19.5 12l-2.7 2.7" />
  </Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
);

export const BellIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18 16.5H6l1.2-2.1V11a4.8 4.8 0 0 1 9.6 0v3.4z" />
    <path d="M10.3 19.2a1.9 1.9 0 0 0 3.4 0" />
  </Icon>
);

export const HelpIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.6a2.3 2.3 0 1 1 2.9 2.3c-.5.2-.7.6-.7 1.1v.6" />
    <path d="M12 16.6h.01" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </Icon>
);

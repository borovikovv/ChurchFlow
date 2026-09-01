import type { ComponentType } from 'react';
import type { OrganizationGroupIcon } from '@churchflow/shared';
import { Icon, type IconProps } from './icon';

export function PreachingIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 4h10a1 1 0 0 1 1 1v6H6V5a1 1 0 0 1 1-1z" />
      <path d="M12 11v9M8 20h8" />
    </Icon>
  );
}

export function WorshipIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </Icon>
  );
}

export function ChoirIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="7" cy="8" r="2.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M3 20v-1.5A3.5 3.5 0 0 1 6.5 15h1A3.5 3.5 0 0 1 11 18.5V20" />
      <path d="M13 20v-1.5a3.5 3.5 0 0 1 3.5-3.5h1a3.5 3.5 0 0 1 3.5 3.5V20" />
    </Icon>
  );
}

export function PrayerIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 21c-2.5-1.5-5-4-5-7V6l5-3 5 3v8c0 3-2.5 5.5-5 7z" />
      <path d="M12 8v6M9.5 11h5" />
    </Icon>
  );
}

export function TeachingIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </Icon>
  );
}

export function ChildrenIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M12 8.5V15M8 11h8M9.5 20l2.5-5 2.5 5" />
    </Icon>
  );
}

export function YouthIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="7" r="2.5" />
      <path d="M4 20v-2a3.5 3.5 0 0 1 3.5-3.5h3A3.5 3.5 0 0 1 14 18v2" />
      <path d="M17 6v8M20.5 9.5h-7" />
    </Icon>
  );
}

export function WomenIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v9M9 17h6" />
    </Icon>
  );
}

export function MenIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="10" cy="14" r="4" />
      <path d="M14 10l6-6M15 4h5v5" />
    </Icon>
  );
}

export function FamilyIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="12" cy="15" r="2" />
      <path d="M3 20v-1a3 3 0 0 1 3-3M21 20v-1a3 3 0 0 0-3-3M9 21v-1a3 3 0 0 1 6 0v1" />
    </Icon>
  );
}

export function MissionsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </Icon>
  );
}

export function EvangelismIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </Icon>
  );
}

export function MediaIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 11l5-3v8l-5-3z" />
    </Icon>
  );
}

export function SoundIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </Icon>
  );
}

export function HospitalityIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 12h13a3 3 0 0 1 0 6H8a4 4 0 0 1-4-4z" />
      <path d="M17 12a3 3 0 0 1 0 6M7 4v3M11 4v3" />
    </Icon>
  );
}

export function UshersIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v7M8 10h8M9 21l3-7 3 7" />
    </Icon>
  );
}

export function CharityIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />
    </Icon>
  );
}

export function SmallGroupIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="8.5" cy="14" r="1.5" />
      <circle cx="15.5" cy="14" r="1.5" />
    </Icon>
  );
}

export function DeaconsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3v18M7 8h10" />
      <path d="M5 21c1.5-2 4-3 7-3s5.5 1 7 3" />
    </Icon>
  );
}

export function LeadershipIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 18h16M4 18V8l4 3 4-6 4 6 4-3v10" />
    </Icon>
  );
}

export function FinanceIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5A2.5 2.5 0 0 0 12.5 8h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1A2.5 2.5 0 0 1 9 14.5M12 6.5v11" />
    </Icon>
  );
}

export function TransportIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 16V8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8" />
      <path d="M17 10h2.2a1 1 0 0 1 .9.6L21 13v3M2 16h20" />
      <circle cx="7.5" cy="18" r="1.5" />
      <circle cx="16.5" cy="18" r="1.5" />
    </Icon>
  );
}

export const GROUP_ICON_COMPONENTS: Record<OrganizationGroupIcon, ComponentType<IconProps>> = {
  preaching: PreachingIcon,
  worship: WorshipIcon,
  choir: ChoirIcon,
  prayer: PrayerIcon,
  teaching: TeachingIcon,
  children: ChildrenIcon,
  youth: YouthIcon,
  women: WomenIcon,
  men: MenIcon,
  family: FamilyIcon,
  missions: MissionsIcon,
  evangelism: EvangelismIcon,
  media: MediaIcon,
  sound: SoundIcon,
  hospitality: HospitalityIcon,
  ushers: UshersIcon,
  charity: CharityIcon,
  smallGroup: SmallGroupIcon,
  deacons: DeaconsIcon,
  leadership: LeadershipIcon,
  finance: FinanceIcon,
  transport: TransportIcon,
};

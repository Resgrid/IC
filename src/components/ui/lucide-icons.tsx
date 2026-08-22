import {
  AlarmClock as RawAlarmClock,
  AlertCircle as RawAlertCircle,
  AlertTriangle as RawAlertTriangle,
  ArrowLeft as RawArrowLeft,
  Bell as RawBell,
  BellIcon as RawBellIcon,
  BluetoothIcon as RawBluetoothIcon,
  BuildingIcon as RawBuildingIcon,
  Calendar as RawCalendar,
  CalendarIcon as RawCalendarIcon,
  Check as RawCheck,
  CheckCircle as RawCheckCircle,
  CheckIcon as RawCheckIcon,
  ChevronDownIcon as RawChevronDownIcon,
  ChevronRight as RawChevronRight,
  ChevronRightIcon as RawChevronRightIcon,
  Circle as RawCircle,
  Edit2Icon as RawEdit2Icon,
  ExternalLink as RawExternalLink,
  EyeIcon as RawEyeIcon,
  EyeOffIcon as RawEyeOffIcon,
  Globe as RawGlobe,
  GlobeIcon as RawGlobeIcon,
  Headphones as RawHeadphones,
  HomeIcon as RawHomeIcon,
  Loader2 as RawLoader2,
  LogIn as RawLogIn,
  type LucideProps,
  MailIcon as RawMailIcon,
  MapPinIcon as RawMapPinIcon,
  MessageCircle as RawMessageCircle,
  Mic as RawMic,
  MicOff as RawMicOff,
  MoreVertical as RawMoreVertical,
  Phone as RawPhone,
  PhoneIcon as RawPhoneIcon,
  PhoneOff as RawPhoneOff,
  Plus as RawPlus,
  PlusIcon as RawPlusIcon,
  RadioTower as RawRadioTower,
  RefreshCw as RawRefreshCw,
  RefreshCwIcon as RawRefreshCwIcon,
  SearchIcon as RawSearchIcon,
  SettingsIcon as RawSettingsIcon,
  ShieldCheck as RawShieldCheck,
  SmartphoneIcon as RawSmartphoneIcon,
  Speaker as RawSpeaker,
  StarIcon as RawStarIcon,
  Tag as RawTag,
  TimerReset as RawTimerReset,
  Trash2 as RawTrash2,
  TrashIcon as RawTrashIcon,
  UserIcon as RawUserIcon,
  Users as RawUsers,
  UsersIcon as RawUsersIcon,
  WifiIcon as RawWifiIcon,
  X as RawX,
} from 'lucide-react-native';
import { styled } from 'nativewind';
import type React from 'react';

/**
 * lucide icons that understand `className`.
 *
 * nativewind v5 dropped the JSX transform: a `className` only has an effect on a component
 * that has been through `styled()`, and metro's polyfill only covers `react-native` itself.
 * On a raw lucide icon the class was silently discarded -- which is why `text-*` colours and
 * `mr-*` spacing had no effect and icons rendered with their default near-black stroke.
 *
 * `target: 'style'` keeps layout utilities working, and `nativeStyleMapping` lifts the
 * resolved colour out of the style object onto lucide's `color` prop, which is where
 * react-native-svg resolves `currentColor` from.
 *
 * Only icons used with a className live here, so the bundle is unchanged; import the rest
 * straight from `lucide-react-native`.
 */
const iconMapping = {
  className: {
    target: 'style',
    nativeStyleMapping: {
      color: 'color',
    },
  },
} as const;

type LucideIcon = React.ComponentType<LucideProps>;

const themed = <T extends LucideIcon>(Component: T): T => styled(Component as LucideIcon, iconMapping) as unknown as T;

export const AlarmClock = themed(RawAlarmClock);
export const AlertCircle = themed(RawAlertCircle);
export const AlertTriangle = themed(RawAlertTriangle);
export const ArrowLeft = themed(RawArrowLeft);
export const Bell = themed(RawBell);
export const BellIcon = themed(RawBellIcon);
export const BluetoothIcon = themed(RawBluetoothIcon);
export const BuildingIcon = themed(RawBuildingIcon);
export const Calendar = themed(RawCalendar);
export const CalendarIcon = themed(RawCalendarIcon);
export const Check = themed(RawCheck);
export const CheckCircle = themed(RawCheckCircle);
export const CheckIcon = themed(RawCheckIcon);
export const ChevronDownIcon = themed(RawChevronDownIcon);
export const ChevronRight = themed(RawChevronRight);
export const ChevronRightIcon = themed(RawChevronRightIcon);
export const Circle = themed(RawCircle);
export const Edit2Icon = themed(RawEdit2Icon);
export const ExternalLink = themed(RawExternalLink);
export const EyeIcon = themed(RawEyeIcon);
export const EyeOffIcon = themed(RawEyeOffIcon);
export const Globe = themed(RawGlobe);
export const GlobeIcon = themed(RawGlobeIcon);
export const Headphones = themed(RawHeadphones);
export const HomeIcon = themed(RawHomeIcon);
export const Loader2 = themed(RawLoader2);
export const LogIn = themed(RawLogIn);
export const MailIcon = themed(RawMailIcon);
export const MapPinIcon = themed(RawMapPinIcon);
export const MessageCircle = themed(RawMessageCircle);
export const Mic = themed(RawMic);
export const MicOff = themed(RawMicOff);
export const MoreVertical = themed(RawMoreVertical);
export const Phone = themed(RawPhone);
export const PhoneIcon = themed(RawPhoneIcon);
export const PhoneOff = themed(RawPhoneOff);
export const Plus = themed(RawPlus);
export const PlusIcon = themed(RawPlusIcon);
export const RadioTower = themed(RawRadioTower);
export const RefreshCw = themed(RawRefreshCw);
export const RefreshCwIcon = themed(RawRefreshCwIcon);
export const SearchIcon = themed(RawSearchIcon);
export const SettingsIcon = themed(RawSettingsIcon);
export const ShieldCheck = themed(RawShieldCheck);
export const SmartphoneIcon = themed(RawSmartphoneIcon);
export const Speaker = themed(RawSpeaker);
export const StarIcon = themed(RawStarIcon);
export const Tag = themed(RawTag);
export const TimerReset = themed(RawTimerReset);
export const Trash2 = themed(RawTrash2);
export const TrashIcon = themed(RawTrashIcon);
export const UserIcon = themed(RawUserIcon);
export const Users = themed(RawUsers);
export const UsersIcon = themed(RawUsersIcon);
export const WifiIcon = themed(RawWifiIcon);
export const X = themed(RawX);

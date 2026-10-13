/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_APP_CLIENT_ID?: string;
  readonly VITE_AWS_REGION?: string;
  readonly VITE_CLOUDFRONT_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'lucide-react' {
  import * as React from 'react';
  export type LucideIcon = React.ForwardRefExoticComponent<
    React.SVGProps<SVGSVGElement> & {
      size?: string | number;
      absoluteStrokeWidth?: boolean;
    }
  >;
  export const Shield: LucideIcon;
  export const Activity: LucideIcon;
  export const Database: LucideIcon;
  export const Key: LucideIcon;
  export const Server: LucideIcon;
  export const Plus: LucideIcon;
  export const Globe: LucideIcon;
  export const Wallet: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Search: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Eye: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const ArrowDownLeft: LucideIcon;
  export const X: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Clock: LucideIcon;
  export const Laptop: LucideIcon;
  export const DollarSign: LucideIcon;
  export const Tag: LucideIcon;
  export const Info: LucideIcon;
  export const Send: LucideIcon;
  export const Zap: LucideIcon;
  export const Lock: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Cloud: LucideIcon;
  export const Cpu: LucideIcon;
  export const Layers: LucideIcon;
}

import {
  Award,
  BarChart3,
  Building2,
  Cpu,
  LayoutDashboard,
  Map,
  Newspaper,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ProfessionalRole } from '@/types/entities';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Quando definido, o item só aparece para estes papéis. */
  roles?: ProfessionalRole[];
}

export const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    to: '/profissionais',
    label: 'Profissionais',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
  },
  { to: '/fabricantes', label: 'Fabricantes', icon: Building2 },
  { to: '/tecnologias', label: 'Tecnologias', icon: Cpu },
  { to: '/certificacoes', label: 'Certificações', icon: Award },
  { to: '/tec-news', label: 'Tec News', icon: Newspaper },
  {
    to: '/roadmap',
    label: 'Roadmap',
    icon: Map,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    roles: ['ADMIN', 'MANAGER'],
  },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function visibleNavItems(role: ProfessionalRole | undefined): NavItem[] {
  return navItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

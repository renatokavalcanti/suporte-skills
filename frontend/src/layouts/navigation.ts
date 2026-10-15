import {
  Award,
  BarChart3,
  Building,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
  LayoutDashboard,
  Library,
  Map,
  Newspaper,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { TICKETS_ENABLED } from '@/config/features';
import type { ProfessionalRole } from '@/types/entities';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Quando definido, o item só aparece para estes papéis. */
  roles?: ProfessionalRole[];
}

/** Grupo de itens exibido como submenu retrátil no menu lateral. */
export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Quando definido, o grupo só aparece para estes papéis. */
  roles?: ProfessionalRole[];
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

export const navItems: NavEntry[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Catálogo',
    icon: Library,
    roles: ['ADMIN', 'MANAGER'],
    children: [
      {
        to: '/profissionais',
        label: 'Profissionais',
        icon: Users,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/fabricantes',
        label: 'Fabricantes',
        icon: Building2,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/tecnologias',
        label: 'Tecnologias',
        icon: Cpu,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/certificacoes',
        label: 'Certificações',
        icon: Award,
        roles: ['ADMIN', 'MANAGER'],
      },
    ],
  } satisfies NavGroup,
  { to: '/tec-news', label: 'Tec News', icon: Newspaper },
  {
    to: '/roadmap',
    label: 'Roadmap',
    icon: Map,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    to: '/meu-roadmap',
    label: 'Meu roadmap',
    icon: Map,
    roles: ['CONSULTANT'],
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    roles: ['ADMIN', 'MANAGER'],
  },
  // Módulo Tickets/Chamados (D-029/D-030): agrupado sob "GSS Qualidade" e
  // exibido só para a gestão, com a flag ligada.
  ...(TICKETS_ENABLED
    ? ([
        {
          label: 'GSS Qualidade',
          icon: ShieldCheck,
          roles: ['ADMIN', 'MANAGER'],
          children: [
            {
              to: '/clientes',
              label: 'Clientes',
              icon: Building,
              roles: ['ADMIN', 'MANAGER'],
            },
            {
              to: '/tickets',
              label: 'Tickets',
              icon: Ticket,
              roles: ['ADMIN', 'MANAGER'],
            },
            {
              to: '/medicoes',
              label: 'Medições',
              icon: ClipboardList,
              roles: ['ADMIN', 'MANAGER'],
            },
            {
              to: '/contratos',
              label: 'Contratos',
              icon: FileText,
              roles: ['ADMIN', 'MANAGER'],
            },
            {
              to: '/relatorios-chamados',
              label: 'Relatórios de Chamados',
              icon: BarChart3,
              roles: ['ADMIN', 'MANAGER'],
            },
          ],
        } satisfies NavGroup,
      ] satisfies NavEntry[])
    : []),
  {
    to: '/releases',
    label: 'Releases',
    icon: Tag,
    roles: ['ADMIN', 'MANAGER'],
  },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function visibleNavItems(role: ProfessionalRole | undefined): NavEntry[] {
  const allowed = (roles?: ProfessionalRole[]) =>
    !roles || (role !== undefined && roles.includes(role));

  return navItems
    .map((entry): NavEntry | null => {
      if (isNavGroup(entry)) {
        if (!allowed(entry.roles)) return null;
        const children = entry.children.filter((child) => allowed(child.roles));
        return children.length ? { ...entry, children } : null;
      }
      return allowed(entry.roles) ? entry : null;
    })
    .filter((entry): entry is NavEntry => entry !== null);
}

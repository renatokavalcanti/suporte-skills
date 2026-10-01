import type {
  CatalogStatus,
  CertificationLevel,
  CertificationStatus,
  NewsConnectorType,
  NewsFocus,
  NewsKind,
  PartnershipStatus,
  ReleaseCategory,
  ProfessionalRole,
  ProfessionalType,
  RoadmapPriority,
  RoadmapStatus,
  RoadmapType,
  Seniority,
  TechnologyCategory,
} from '@/types/entities';

export const roleLabels: Record<ProfessionalRole, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  CONSULTANT: 'Consultor',
};

export const professionalTypeLabels: Record<ProfessionalType, string> = {
  CLT: 'CLT',
  PJ: 'PJ',
  INTERN: 'Estágio',
  PARTNER: 'Parceiro',
  TEMPORARY: 'Temporário',
};

export const seniorityLabels: Record<Seniority, string> = {
  JUNIOR: 'Júnior',
  MID: 'Pleno',
  SENIOR: 'Sênior',
  SPECIALIST: 'Especialista',
  LEAD: 'Líder',
};

export const partnershipStatusLabels: Record<PartnershipStatus, string> = {
  NONE: 'Sem parceria',
  ACTIVE: 'Ativa',
  PENDING: 'Pendente',
  SUSPENDED: 'Suspensa',
  EXPIRED: 'Expirada',
};

export const partnershipStatusVariant: Record<
  PartnershipStatus,
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  NONE: 'neutral',
  ACTIVE: 'success',
  PENDING: 'warning',
  SUSPENDED: 'warning',
  EXPIRED: 'danger',
};

export const technologyCategoryLabels: Record<TechnologyCategory, string> = {
  OPERATING_SYSTEM: 'Sistema operacional',
  VIRTUALIZATION: 'Virtualização',
  CONTAINER_PLATFORM: 'Plataforma de containers',
  CLOUD: 'Cloud',
  AUTOMATION: 'Automação',
  BACKUP: 'Backup',
  STORAGE: 'Storage',
  HARDWARE: 'Hardware',
  NETWORK: 'Rede',
  MANAGEMENT: 'Gerenciamento',
  SECURITY: 'Segurança',
  OTHER: 'Outro',
};

export const certificationLevelLabels: Record<CertificationLevel, string> = {
  FOUNDATIONAL: 'Fundamental',
  ASSOCIATE: 'Associate',
  PROFESSIONAL: 'Professional',
  EXPERT: 'Expert',
  SPECIALIST: 'Specialist',
  ARCHITECT: 'Architect',
};

export const catalogStatusLabels: Record<CatalogStatus, string> = {
  ACTIVE: 'Ativa',
  UPDATING: 'Em atualização',
  DISCONTINUED: 'Descontinuada',
  REPLACED: 'Substituída',
};

export const catalogStatusVariant: Record<
  CatalogStatus,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  ACTIVE: 'success',
  UPDATING: 'warning',
  DISCONTINUED: 'danger',
  REPLACED: 'neutral',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Converte as entradas de um record em opções de <select>. */
export function toOptions<T extends string>(
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

export const certificationStatusLabels: Record<CertificationStatus, string> = {
  ACTIVE: 'Ativa',
  EXPIRING: 'Expirando',
  EXPIRED: 'Vencida',
  NO_EXPIRATION: 'Sem validade',
};

export const certificationStatusVariant: Record<
  CertificationStatus,
  'success' | 'warning' | 'danger' | 'info'
> = {
  ACTIVE: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  NO_EXPIRATION: 'info',
};

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} dia(s) em atraso`;
  if (days === 0) return 'vence hoje';
  return `${days} dia(s)`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

export const roadmapTypeLabels: Record<RoadmapType, string> = {
  CERTIFICATION: 'Certificação',
  RENEWAL: 'Renovação',
  COURSE: 'Curso',
  TRAINING: 'Treinamento',
  PROJECT: 'Projeto',
  LAB: 'Laboratório',
};

export const roadmapPriorityLabels: Record<RoadmapPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const roadmapPriorityVariant: Record<
  RoadmapPriority,
  'danger' | 'warning' | 'info' | 'neutral'
> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

export function roadmapPriorityRank(priority: RoadmapPriority): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[priority];
}

export const roadmapStatusLabels: Record<RoadmapStatus, string> = {
  BACKLOG: 'Backlog',
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const roadmapStatusOrder: RoadmapStatus[] = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const roadmapStatusVariant: Record<
  RoadmapStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  BACKLOG: 'neutral',
  PLANNED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const newsKindLabels: Record<NewsKind, string> = {
  RELEASE: 'Release',
  CERTIFICATION: 'Certificação',
  FEATURE: 'Funcionalidade',
  SECURITY: 'Segurança',
  EVENT: 'Evento',
  GENERAL: 'Geral',
};

export const newsKindVariant: Record<
  NewsKind,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  RELEASE: 'info',
  CERTIFICATION: 'success',
  FEATURE: 'neutral',
  SECURITY: 'danger',
  EVENT: 'warning',
  GENERAL: 'neutral',
};

export const newsConnectorLabels: Record<NewsConnectorType, string> = {
  RSS: 'RSS',
  ATOM: 'Atom',
  MANUAL: 'Manual',
};

export const newsFocusLabels: Record<NewsFocus, string> = {
  FEATURE: 'Funcionalidade',
  CERTIFICATION: 'Certificação',
  SECURITY: 'Segurança',
  RELEASE: 'Release',
  OTHER: 'Geral',
};

export const newsFocusVariant: Record<
  NewsFocus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  FEATURE: 'info',
  CERTIFICATION: 'success',
  SECURITY: 'danger',
  RELEASE: 'neutral',
  OTHER: 'neutral',
};

export const releaseCategoryLabels: Record<ReleaseCategory, string> = {
  FEATURE: 'Novidade',
  IMPROVEMENT: 'Melhoria',
  FIX: 'Correção',
  SECURITY: 'Segurança',
  INFRA: 'Infraestrutura',
  OTHER: 'Outro',
};

export const releaseCategoryVariant: Record<
  ReleaseCategory,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  FEATURE: 'info',
  IMPROVEMENT: 'success',
  FIX: 'warning',
  SECURITY: 'danger',
  INFRA: 'neutral',
  OTHER: 'neutral',
};

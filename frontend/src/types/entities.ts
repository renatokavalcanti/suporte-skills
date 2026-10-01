export type ProfessionalRole = 'ADMIN' | 'MANAGER' | 'CONSULTANT';
export type ProfessionalType =
  | 'CLT'
  | 'PJ'
  | 'INTERN'
  | 'PARTNER'
  | 'TEMPORARY';
export type Seniority = 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD';
export type PartnershipStatus =
  | 'NONE'
  | 'ACTIVE'
  | 'PENDING'
  | 'SUSPENDED'
  | 'EXPIRED';
export type TechnologyCategory =
  | 'OPERATING_SYSTEM'
  | 'VIRTUALIZATION'
  | 'CONTAINER_PLATFORM'
  | 'CLOUD'
  | 'AUTOMATION'
  | 'BACKUP'
  | 'STORAGE'
  | 'HARDWARE'
  | 'NETWORK'
  | 'MANAGEMENT'
  | 'SECURITY'
  | 'OTHER';
export type CertificationLevel =
  | 'FOUNDATIONAL'
  | 'ASSOCIATE'
  | 'PROFESSIONAL'
  | 'EXPERT'
  | 'SPECIALIST'
  | 'ARCHITECT';
export type CatalogStatus = 'ACTIVE' | 'UPDATING' | 'DISCONTINUED' | 'REPLACED';

export type CertificationStatus =
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'NO_EXPIRATION';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ProfessionalStats {
  certifications: number;
  expiring: number;
  expired: number;
  openRoadmap: number;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  position: string | null;
  role: ProfessionalRole;
  professionalType: ProfessionalType | null;
  seniority: Seniority | null;
  active: boolean;
  hireDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stats: ProfessionalStats;
}

export interface Vendor {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  partnershipStatus: PartnershipStatus;
  partnershipLevel: string | null;
  partnershipStartDate: string | null;
  partnershipRenewalDate: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { technologies: number; certifications: number };
}

export interface Technology {
  id: string;
  vendorId: string;
  name: string;
  category: TechnologyCategory | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string };
  _count: { certifications: number };
}

export interface Certification {
  id: string;
  vendorId: string;
  technologyId: string | null;
  name: string;
  code: string | null;
  level: CertificationLevel | null;
  officialUrl: string | null;
  validityMonths: number | null;
  catalogStatus: CatalogStatus;
  description: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string };
  technology: { id: string; name: string } | null;
  _count: { professionalCertifications: number };
}

export interface ProfessionalCertification {
  id: string;
  professionalId: string;
  certificationId: string;
  certificateNumber: string | null;
  obtainedAt: string | null;
  expiresAt: string | null;
  proofUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  status: CertificationStatus;
  daysRemaining: number | null;
  certification: {
    id: string;
    name: string;
    code: string | null;
    level: CertificationLevel | null;
    officialUrl: string | null;
    validityMonths: number | null;
    catalogStatus: CatalogStatus;
    vendor: { id: string; name: string };
    technology: { id: string; name: string } | null;
  };
}

export interface TechnologyCoverage {
  technologyId: string | null;
  name: string;
  vendorName: string | null;
  category: TechnologyCategory | null;
  certifications: number;
  status: CertificationStatus;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type RoadmapType =
  | 'CERTIFICATION'
  | 'RENEWAL'
  | 'COURSE'
  | 'TRAINING'
  | 'PROJECT'
  | 'LAB';
export type RoadmapPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RoadmapStatus =
  | 'BACKLOG'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RoadmapItem {
  id: string;
  professionalId: string;
  technologyId: string | null;
  certificationId: string | null;
  title: string;
  objective: string | null;
  description: string | null;
  type: RoadmapType;
  priority: RoadmapPriority;
  status: RoadmapStatus;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  daysToDue: number | null;
  professional: { id: string; name: string };
  owner: { id: string; name: string } | null;
  technology: { id: string; name: string; vendor: { id: string; name: string } } | null;
  certification: {
    id: string;
    name: string;
    code: string | null;
    vendor: { id: string; name: string };
  } | null;
}

export interface DashboardCards {
  professionals: number;
  certificationsAssigned: number;
  expiring: number;
  expired: number;
  openRoadmap: number;
  overdueRoadmap: number;
}

export interface ExpirationItem {
  professionalId: string;
  professionalName: string;
  certificationName: string;
  vendorName: string;
  expiresAt: string;
  daysRemaining: number;
  status: CertificationStatus;
}

export interface RoadmapBucketItem {
  id: string;
  title: string;
  professionalName: string;
  dueDate: string | null;
  daysToDue: number | null;
  priority: RoadmapPriority;
  status: RoadmapStatus;
  isOverdue: boolean;
}

export interface RoadmapBucket {
  count: number;
  items: RoadmapBucketItem[];
}

export interface RoadmapBuckets {
  overdue: RoadmapBucket;
  next30: RoadmapBucket;
  days31to90: RoadmapBucket;
  next6Months: RoadmapBucket;
}

export interface AlertItem {
  type: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
}

export interface CoverageItem {
  technologyId: string;
  technologyName: string;
  vendorName: string;
  coveredProfessionals: number;
  totalProfessionals: number;
  coverage: number;
}

export interface DashboardOverview {
  generatedAt: string;
  expiringThresholdDays: number;
  cards: DashboardCards;
  certificationStatus: Record<CertificationStatus, number>;
  upcomingExpirations: ExpirationItem[];
  roadmap: RoadmapBuckets;
  alerts: AlertItem[];
  coverage: CoverageItem[];
}

export interface ReportColumn {
  key: string;
  label: string;
}

export type ReportCellValue = string | number | null;

export interface ReportResult {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCellValue>[];
  summary?: Record<string, number>;
  generatedAt: string;
}

export type ReportKey = 'certifications' | 'expirations' | 'roadmap' | 'vendors';

export type ImportType = 'professionals' | 'certifications';

export interface ImportRowResult {
  line: number;
  status: 'valid' | 'invalid';
  errors: string[];
  data: Record<string, string>;
}

export interface ImportPreview {
  type: ImportType;
  total: number;
  valid: number;
  invalid: number;
  columns: { key: string; label: string }[];
  rows: ImportRowResult[];
}

export interface ImportCommitResult {
  type: ImportType;
  total: number;
  imported: number;
  skipped: number;
  errors: { line: number; errors: string[] }[];
}

export type NewsKind =
  | 'RELEASE'
  | 'CERTIFICATION'
  | 'FEATURE'
  | 'SECURITY'
  | 'EVENT'
  | 'GENERAL';

export type NewsConnectorType = 'RSS' | 'ATOM' | 'MANUAL';

export interface NewsItem {
  id: string;
  sourceId: string | null;
  vendorId: string | null;
  technologyId: string | null;
  externalId: string | null;
  url: string;
  title: string;
  summary: string | null;
  author: string | null;
  kind: NewsKind;
  origin: string;
  publishedAt: string | null;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string } | null;
  technology: { id: string; name: string } | null;
  source: { id: string; name: string; connectorType: NewsConnectorType } | null;
  read: boolean;
  saved: boolean;
}

export interface NewsSource {
  id: string;
  vendorId: string;
  technologyId: string | null;
  name: string;
  url: string | null;
  connectorType: NewsConnectorType;
  active: boolean;
  fetchIntervalMinutes: number | null;
  lastFetchedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastItemCount: number | null;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string };
  technology: { id: string; name: string } | null;
  _count: { items: number };
}

export interface NewsSummary {
  total: number;
  pinned: number;
  unread: number;
  saved: number;
}

export interface SyncSummary {
  sources: number;
  fetched: number;
  created: number;
  updated: number;
  errors: { sourceId: string; source: string; message: string }[];
}

export interface SyncSourceResult {
  fetched: number;
  created: number;
  updated: number;
}

export type ReleaseCategory =
  | 'FEATURE'
  | 'IMPROVEMENT'
  | 'FIX'
  | 'SECURITY'
  | 'INFRA'
  | 'OTHER';

export interface ReleaseItem {
  id: string;
  category: ReleaseCategory;
  description: string;
  position: number;
}

export interface Release {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  releasedAt: string;
  current: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  items: ReleaseItem[];
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string } | null;
}

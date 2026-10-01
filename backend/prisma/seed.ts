/**
 * Seed DEMO do Suporte Skills.
 *
 * - Dados 100% ficticios (nenhuma pessoa real).
 * - Idempotente: usa ids/emails determininisticos e upsert.
 * - As datas sao relativas a "hoje" para que o dashboard sempre tenha
 *   certificacoes ativas, expirando, vencidas e sem validade, alem de
 *   roadmaps em andamento e atrasados.
 *
 * Uso: npm run seed
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const DEMO = 'Dados demonstrativos (DEMO)';

function dateIn(days: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@suporte.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const defaultPassword = await hash('Suporte@123');
  const adminHash = await hash(adminPassword);

  // -------------------------------------------------------------------------
  // Profissionais / usuarios (D-003: mesma entidade)
  // -------------------------------------------------------------------------
  interface DemoProfessional {
    id: string;
    name: string;
    email: string;
    role: Role;
    passwordHash: string | null;
    position: string;
    seniority: 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD';
    hireDate: Date;
  }

  const professionals: DemoProfessional[] = [
    {
      id: 'prof-joao-silva',
      name: 'Joao Silva',
      email: adminEmail,
      role: Role.ADMIN,
      passwordHash: adminHash,
      position: 'Arquiteto de Solucoes',
      seniority: 'SENIOR',
      hireDate: dateIn(-2400),
    },
    {
      id: 'prof-maria-oliveira',
      name: 'Maria Oliveira',
      email: 'maria.oliveira@suporte.local',
      role: Role.MANAGER,
      passwordHash: defaultPassword,
      position: 'Coordenadora de Infraestrutura',
      seniority: 'MID',
      hireDate: dateIn(-1500),
    },
    {
      id: 'prof-carlos-souza',
      name: 'Carlos Souza',
      email: 'carlos.souza@suporte.local',
      role: Role.CONSULTANT,
      passwordHash: defaultPassword,
      position: 'Consultor Nutanix',
      seniority: 'SENIOR',
      hireDate: dateIn(-1800),
    },
    {
      id: 'prof-pedro-santos',
      name: 'Pedro Santos',
      email: 'pedro.santos@suporte.local',
      role: Role.CONSULTANT,
      passwordHash: defaultPassword,
      position: 'Analista de Backup e Virtualizacao',
      seniority: 'MID',
      hireDate: dateIn(-900),
    },
    {
      id: 'prof-andre-lima',
      name: 'Andre Lima',
      email: 'andre.lima@suporte.local',
      role: Role.CONSULTANT,
      passwordHash: defaultPassword,
      position: 'Especialista em Storage IBM',
      seniority: 'SPECIALIST',
      hireDate: dateIn(-3000),
    },
    {
      id: 'prof-lucas-almeida',
      name: 'Lucas Almeida',
      email: 'lucas.almeida@suporte.local',
      role: Role.CONSULTANT,
      passwordHash: defaultPassword,
      position: 'Analista de Infraestrutura Junior',
      seniority: 'JUNIOR',
      hireDate: dateIn(-120),
    },
  ];

  for (const p of professionals) {
    await prisma.professional.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        email: p.email,
        role: p.role,
        passwordHash: p.passwordHash,
        position: p.position,
        seniority: p.seniority,
        hireDate: p.hireDate,
        active: true,
        notes: DEMO,
      },
      create: {
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        passwordHash: p.passwordHash,
        position: p.position,
        professionalType: 'CLT',
        seniority: p.seniority,
        hireDate: p.hireDate,
        active: true,
        notes: DEMO,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Fabricantes
  // -------------------------------------------------------------------------
  const vendors = [
    { id: 'ven-redhat', name: 'Red Hat', website: 'https://www.redhat.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Advanced Partner' },
    { id: 'ven-nutanix', name: 'Nutanix', website: 'https://www.nutanix.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Nutanix Partner' },
    { id: 'ven-ibm', name: 'IBM', website: 'https://www.ibm.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Business Partner' },
    { id: 'ven-exagrid', name: 'ExaGrid', website: 'https://www.exagrid.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Reseller' },
    { id: 'ven-canonical', name: 'Canonical', website: 'https://canonical.com', partnershipStatus: 'PENDING' as const, partnershipLevel: null },
    { id: 'ven-suse', name: 'SUSE', website: 'https://www.suse.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Silver Partner' },
    { id: 'ven-veeam', name: 'Veeam', website: 'https://www.veeam.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Gold Partner' },
    { id: 'ven-vmware', name: 'VMware by Broadcom', website: 'https://www.broadcom.com', partnershipStatus: 'ACTIVE' as const, partnershipLevel: 'Premier Partner' },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      update: { name: v.name, website: v.website, partnershipStatus: v.partnershipStatus, partnershipLevel: v.partnershipLevel, active: true, notes: DEMO },
      create: { id: v.id, name: v.name, website: v.website, partnershipStatus: v.partnershipStatus, partnershipLevel: v.partnershipLevel, active: true, notes: DEMO },
    });
  }

  // -------------------------------------------------------------------------
  // Tecnologias
  // -------------------------------------------------------------------------
  const technologies = [
    { id: 'tec-rhel', vendorId: 'ven-redhat', name: 'RHEL', category: 'OPERATING_SYSTEM' as const },
    { id: 'tec-satellite', vendorId: 'ven-redhat', name: 'Red Hat Satellite', category: 'MANAGEMENT' as const },
    { id: 'tec-ansible', vendorId: 'ven-redhat', name: 'Ansible', category: 'AUTOMATION' as const },
    { id: 'tec-openshift', vendorId: 'ven-redhat', name: 'OpenShift', category: 'CONTAINER_PLATFORM' as const },
    { id: 'tec-ocpvirt', vendorId: 'ven-redhat', name: 'OpenShift Virtualization', category: 'VIRTUALIZATION' as const },
    { id: 'tec-nci', vendorId: 'ven-nutanix', name: 'NCI', category: 'VIRTUALIZATION' as const },
    { id: 'tec-ncm', vendorId: 'ven-nutanix', name: 'NCM', category: 'MANAGEMENT' as const },
    { id: 'tec-ahv', vendorId: 'ven-nutanix', name: 'AHV', category: 'VIRTUALIZATION' as const },
    { id: 'tec-ndb', vendorId: 'ven-nutanix', name: 'NDB', category: 'BACKUP' as const },
    { id: 'tec-flow', vendorId: 'ven-nutanix', name: 'Flow', category: 'NETWORK' as const },
    { id: 'tec-ibm-storage', vendorId: 'ven-ibm', name: 'IBM Storage', category: 'STORAGE' as const },
    { id: 'tec-exagrid', vendorId: 'ven-exagrid', name: 'ExaGrid Backup Storage', category: 'BACKUP' as const },
    { id: 'tec-ubuntu', vendorId: 'ven-canonical', name: 'Ubuntu Server', category: 'OPERATING_SYSTEM' as const },
    { id: 'tec-maas', vendorId: 'ven-canonical', name: 'MAAS', category: 'MANAGEMENT' as const },
    { id: 'tec-sle', vendorId: 'ven-suse', name: 'SUSE Linux Enterprise', category: 'OPERATING_SYSTEM' as const },
    { id: 'tec-veeam-br', vendorId: 'ven-veeam', name: 'Veeam Backup & Replication', category: 'BACKUP' as const },
    { id: 'tec-veeam-dp', vendorId: 'ven-veeam', name: 'Veeam Data Platform', category: 'BACKUP' as const },
    { id: 'tec-vsphere', vendorId: 'ven-vmware', name: 'vSphere', category: 'VIRTUALIZATION' as const },
    { id: 'tec-nsx', vendorId: 'ven-vmware', name: 'VMware NSX', category: 'NETWORK' as const },
  ];

  for (const t of technologies) {
    await prisma.technology.upsert({
      where: { id: t.id },
      update: { vendorId: t.vendorId, name: t.name, category: t.category, active: true },
      create: { id: t.id, vendorId: t.vendorId, name: t.name, category: t.category, active: true },
    });
  }

  // -------------------------------------------------------------------------
  // Certificacoes (catalogo)
  // -------------------------------------------------------------------------
  const certifications = [
    { id: 'cer-rhcsa', vendorId: 'ven-redhat', technologyId: 'tec-rhel', name: 'Red Hat Certified System Administrator (RHCSA)', code: 'EX200', level: 'ASSOCIATE' as const, validityMonths: 36 },
    { id: 'cer-rhce', vendorId: 'ven-redhat', technologyId: 'tec-ansible', name: 'Red Hat Certified Engineer (RHCE)', code: 'EX294', level: 'PROFESSIONAL' as const, validityMonths: 36 },
    { id: 'cer-rhca', vendorId: 'ven-redhat', technologyId: 'tec-rhel', name: 'Red Hat Certified Architect (RHCA)', code: null, level: 'ARCHITECT' as const, validityMonths: 36 },
    { id: 'cer-rh-ocp', vendorId: 'ven-redhat', technologyId: 'tec-openshift', name: 'Red Hat Certified Specialist in OpenShift Administration', code: 'EX280', level: 'PROFESSIONAL' as const, validityMonths: 36 },
    { id: 'cer-ncp-mci', vendorId: 'ven-nutanix', technologyId: 'tec-nci', name: 'Nutanix Certified Professional - Multicloud Infrastructure', code: 'NCP-MCI', level: 'PROFESSIONAL' as const, validityMonths: 24 },
    { id: 'cer-ncm-mci', vendorId: 'ven-nutanix', technologyId: 'tec-ncm', name: 'Nutanix Certified Master - Multicloud Infrastructure', code: 'NCM-MCI', level: 'EXPERT' as const, validityMonths: 24 },
    { id: 'cer-ncs-core', vendorId: 'ven-nutanix', technologyId: 'tec-nci', name: 'Nutanix Certified Specialist - Core', code: 'NCS-Core', level: 'ASSOCIATE' as const, validityMonths: 24 },
    { id: 'cer-vmce', vendorId: 'ven-veeam', technologyId: 'tec-veeam-br', name: 'Veeam Certified Engineer (VMCE)', code: 'VMCE', level: 'PROFESSIONAL' as const, validityMonths: 24 },
    { id: 'cer-vcp-dcv', vendorId: 'ven-vmware', technologyId: 'tec-vsphere', name: 'VMware Certified Professional - Data Center Virtualization', code: 'VCP-DCV', level: 'PROFESSIONAL' as const, validityMonths: 36 },
    { id: 'cer-vcp-nv', vendorId: 'ven-vmware', technologyId: 'tec-nsx', name: 'VMware Certified Professional - Network Virtualization', code: 'VCP-NV', level: 'PROFESSIONAL' as const, validityMonths: 36 },
    { id: 'cer-ibm-storage', vendorId: 'ven-ibm', technologyId: 'tec-ibm-storage', name: 'IBM Certified Specialist - Storage', code: null, level: 'PROFESSIONAL' as const, validityMonths: null },
    { id: 'cer-sca', vendorId: 'ven-suse', technologyId: 'tec-sle', name: 'SUSE Certified Administrator', code: 'SCA', level: 'ASSOCIATE' as const, validityMonths: 36 },
    { id: 'cer-ubuntu', vendorId: 'ven-canonical', technologyId: 'tec-ubuntu', name: 'Canonical Certified Professional - Ubuntu', code: null, level: 'PROFESSIONAL' as const, validityMonths: 36 },
  ];

  for (const c of certifications) {
    await prisma.certification.upsert({
      where: { id: c.id },
      update: { vendorId: c.vendorId, technologyId: c.technologyId, name: c.name, code: c.code, level: c.level, validityMonths: c.validityMonths, active: true },
      create: { id: c.id, vendorId: c.vendorId, technologyId: c.technologyId, name: c.name, code: c.code, level: c.level, validityMonths: c.validityMonths, active: true },
    });
  }

  // -------------------------------------------------------------------------
  // Certificacoes dos profissionais (variedade de status)
  // -------------------------------------------------------------------------
  const professionalCertifications = [
    // Joao: 2 ativas + 1 expirando
    { id: 'pc-joao-rhcsa', professionalId: 'prof-joao-silva', certificationId: 'cer-rhcsa', obtainedAt: dateIn(-700), expiresAt: dateIn(380), certificateNumber: 'RH-1001' },
    { id: 'pc-joao-rhce', professionalId: 'prof-joao-silva', certificationId: 'cer-rhce', obtainedAt: dateIn(-600), expiresAt: dateIn(500), certificateNumber: 'RH-1002' },
    { id: 'pc-joao-ocp', professionalId: 'prof-joao-silva', certificationId: 'cer-rh-ocp', obtainedAt: dateIn(-680), expiresAt: dateIn(45), certificateNumber: 'RH-1003' },
    // Carlos: 1 ativa + 1 expirando + 1 vencida
    { id: 'pc-carlos-ncp', professionalId: 'prof-carlos-souza', certificationId: 'cer-ncp-mci', obtainedAt: dateIn(-400), expiresAt: dateIn(330), certificateNumber: 'NX-2001' },
    { id: 'pc-carlos-ncm', professionalId: 'prof-carlos-souza', certificationId: 'cer-ncm-mci', obtainedAt: dateIn(-350), expiresAt: dateIn(75), certificateNumber: 'NX-2002' },
    { id: 'pc-carlos-ncs', professionalId: 'prof-carlos-souza', certificationId: 'cer-ncs-core', obtainedAt: dateIn(-900), expiresAt: dateIn(-40), certificateNumber: 'NX-2003' },
    // Pedro: 2 ativas
    { id: 'pc-pedro-vmce', professionalId: 'prof-pedro-santos', certificationId: 'cer-vmce', obtainedAt: dateIn(-200), expiresAt: dateIn(530), certificateNumber: 'VE-3001' },
    { id: 'pc-pedro-vcp', professionalId: 'prof-pedro-santos', certificationId: 'cer-vcp-dcv', obtainedAt: dateIn(-500), expiresAt: dateIn(120), certificateNumber: 'VM-3002' },
    // Andre: sem validade
    { id: 'pc-andre-ibm', professionalId: 'prof-andre-lima', certificationId: 'cer-ibm-storage', obtainedAt: dateIn(-1200), expiresAt: null, certificateNumber: 'IB-4001' },
    // Maria: 1 expirando + 1 ativa
    { id: 'pc-maria-sca', professionalId: 'prof-maria-oliveira', certificationId: 'cer-sca', obtainedAt: dateIn(-1070), expiresAt: dateIn(30), certificateNumber: 'SU-5001' },
    { id: 'pc-maria-ubuntu', professionalId: 'prof-maria-oliveira', certificationId: 'cer-ubuntu', obtainedAt: dateIn(-300), expiresAt: dateIn(800), certificateNumber: 'CA-5002' },
  ];

  for (const pc of professionalCertifications) {
    await prisma.professionalCertification.upsert({
      where: { id: pc.id },
      update: { professionalId: pc.professionalId, certificationId: pc.certificationId, obtainedAt: pc.obtainedAt, expiresAt: pc.expiresAt, certificateNumber: pc.certificateNumber },
      create: { id: pc.id, professionalId: pc.professionalId, certificationId: pc.certificationId, obtainedAt: pc.obtainedAt, expiresAt: pc.expiresAt, certificateNumber: pc.certificateNumber, notes: DEMO },
    });
  }

  // -------------------------------------------------------------------------
  // Roadmap (em andamento, atrasado, planejado, concluido)
  // -------------------------------------------------------------------------
  const roadmapItems = [
    { id: 'rm-lucas-rhcsa', professionalId: 'prof-lucas-almeida', technologyId: 'tec-rhel', certificationId: 'cer-rhcsa', title: 'Obter certificacao RHCSA', type: 'CERTIFICATION' as const, priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, startDate: dateIn(-30), dueDate: dateIn(20), ownerId: 'prof-maria-oliveira' },
    { id: 'rm-lucas-ansible', professionalId: 'prof-lucas-almeida', technologyId: 'tec-ansible', certificationId: null, title: 'Curso de Automacao com Ansible', type: 'COURSE' as const, priority: 'MEDIUM' as const, status: 'BACKLOG' as const, startDate: null, dueDate: dateIn(120), ownerId: 'prof-lucas-almeida' },
    { id: 'rm-maria-renew-sca', professionalId: 'prof-maria-oliveira', technologyId: 'tec-sle', certificationId: 'cer-sca', title: 'Renovar certificacao SCA', type: 'RENEWAL' as const, priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, startDate: dateIn(-10), dueDate: dateIn(25), ownerId: 'prof-maria-oliveira' },
    { id: 'rm-carlos-recert-ncs', professionalId: 'prof-carlos-souza', technologyId: 'tec-nci', certificationId: 'cer-ncs-core', title: 'Recertificar NCS-Core', type: 'RENEWAL' as const, priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, startDate: dateIn(-60), dueDate: dateIn(-10), ownerId: 'prof-carlos-souza' },
    { id: 'rm-pedro-vcpnv', professionalId: 'prof-pedro-santos', technologyId: 'tec-nsx', certificationId: 'cer-vcp-nv', title: 'Obter VCP-NV (Network Virtualization)', type: 'CERTIFICATION' as const, priority: 'HIGH' as const, status: 'PLANNED' as const, startDate: dateIn(15), dueDate: dateIn(150), ownerId: 'prof-pedro-santos' },
    { id: 'rm-joao-rhca', professionalId: 'prof-joao-silva', technologyId: 'tec-rhel', certificationId: 'cer-rhca', title: 'Trilha para RHCA', type: 'CERTIFICATION' as const, priority: 'MEDIUM' as const, status: 'PLANNED' as const, startDate: null, dueDate: dateIn(200), ownerId: 'prof-joao-silva' },
    { id: 'rm-andre-exagrid', professionalId: 'prof-andre-lima', technologyId: 'tec-exagrid', certificationId: null, title: 'Laboratorio ExaGrid', type: 'LAB' as const, priority: 'LOW' as const, status: 'COMPLETED' as const, startDate: dateIn(-40), dueDate: dateIn(-20), completedAt: dateIn(-18), ownerId: 'prof-andre-lima' },
    { id: 'rm-carlos-flow', professionalId: 'prof-carlos-souza', technologyId: 'tec-flow', certificationId: null, title: 'Treinamento Nutanix Flow', type: 'TRAINING' as const, priority: 'MEDIUM' as const, status: 'BACKLOG' as const, startDate: null, dueDate: dateIn(90), ownerId: 'prof-carlos-souza' },
  ];

  for (const r of roadmapItems) {
    await prisma.roadmapItem.upsert({
      where: { id: r.id },
      update: { professionalId: r.professionalId, technologyId: r.technologyId, certificationId: r.certificationId, title: r.title, type: r.type, priority: r.priority, status: r.status, startDate: r.startDate, dueDate: r.dueDate, completedAt: r.completedAt ?? null, ownerId: r.ownerId },
      create: { id: r.id, professionalId: r.professionalId, technologyId: r.technologyId, certificationId: r.certificationId, title: r.title, type: r.type, priority: r.priority, status: r.status, startDate: r.startDate, dueDate: r.dueDate, completedAt: r.completedAt ?? null, ownerId: r.ownerId, notes: DEMO },
    });
  }

  // -------------------------------------------------------------------------
  // Tec News — fontes oficiais (RSS) e novidades DEMO
  // Links ficticios (example.com) para nao colidirem com itens reais dos feeds
  // quando a sincronizacao estiver ligada.
  // -------------------------------------------------------------------------
  const newsSources = [
    { id: 'ns-redhat-blog', vendorId: 'ven-redhat', name: 'Red Hat Blog (RSS)', url: 'https://www.redhat.com/en/rss/blog' },
    { id: 'ns-nutanix-news', vendorId: 'ven-nutanix', name: 'Nutanix News Releases (RSS)', url: 'https://ir.nutanix.com/rss/news-releases.xml' },
    { id: 'ns-veeam-blog', vendorId: 'ven-veeam', name: 'Veeam Blog (RSS)', url: 'https://www.veeam.com/blog/feed/' },
    { id: 'ns-suse-blog', vendorId: 'ven-suse', name: 'SUSE Blog (RSS)', url: 'https://www.suse.com/c/feed/' },
    { id: 'ns-exagrid-news', vendorId: 'ven-exagrid', name: 'ExaGrid News (RSS)', url: 'https://www.exagrid.com/feed/' },
  ];

  for (const s of newsSources) {
    await prisma.newsSource.upsert({
      where: { id: s.id },
      update: { vendorId: s.vendorId, technologyId: null, name: s.name, url: s.url, connectorType: 'RSS', active: true },
      create: { id: s.id, vendorId: s.vendorId, technologyId: null, name: s.name, url: s.url, connectorType: 'RSS', active: true },
    });
  }

  const newsItems = [
    { id: 'ni-demo-rhel', vendorId: 'ven-redhat', technologyId: 'tec-rhel', kind: 'RELEASE' as const, pinned: true, title: 'RHEL 10.1 chega com melhorias em seguranca e automacao', summary: 'Nova minor release do RHEL 10 reforca politicas de seguranca e automatizacao com Ansible.', url: 'https://example.com/demo/redhat-rhel-101', publishedAt: dateIn(-3) },
    { id: 'ni-demo-nutanix-cert', vendorId: 'ven-nutanix', technologyId: 'tec-nci', kind: 'CERTIFICATION' as const, pinned: false, title: 'Nutanix atualiza trilha de certificacao NCP-MCI', summary: 'A certificacao passa a cobrir novos topicos de multicloud e automacao.', url: 'https://example.com/demo/nutanix-ncp-mci', publishedAt: dateIn(-8) },
    { id: 'ni-demo-veeam-release', vendorId: 'ven-veeam', technologyId: 'tec-veeam-dp', kind: 'RELEASE' as const, pinned: false, title: 'Veeam Data Platform amplia protecao para ambientes hibridos', summary: 'Release traz melhorias em imutabilidade, recuperacao e integracao com nuvem.', url: 'https://example.com/demo/veeam-data-platform', publishedAt: dateIn(-5) },
    { id: 'ni-demo-suse-security', vendorId: 'ven-suse', technologyId: 'tec-sle', kind: 'SECURITY' as const, pinned: false, title: 'SUSE publica atualizacao de seguranca para SUSE Linux Enterprise', summary: 'Correcoes de vulnerabilidades para pacotes do SUSE Linux Enterprise Server.', url: 'https://example.com/demo/suse-security', publishedAt: dateIn(-2) },
    { id: 'ni-demo-exagrid-release', vendorId: 'ven-exagrid', technologyId: 'tec-exagrid', kind: 'RELEASE' as const, pinned: false, title: 'ExaGrid lanca nova versao com suporte a novos alvos de backup', summary: 'Atualizacao amplia a integracao com plataformas de backup e quotas por cliente.', url: 'https://example.com/demo/exagrid-release', publishedAt: dateIn(-12) },
    { id: 'ni-demo-redhat-event', vendorId: 'ven-redhat', technologyId: 'tec-openshift', kind: 'EVENT' as const, pinned: false, title: 'Webinar: trilha de certificacao OpenShift', summary: 'Sessao online apresenta a trilha de certificacao em administracao OpenShift.', url: 'https://example.com/demo/redhat-openshift-webinar', publishedAt: dateIn(-1) },
  ];

  for (const n of newsItems) {
    await prisma.newsItem.upsert({
      where: { id: n.id },
      update: { vendorId: n.vendorId, technologyId: n.technologyId, title: n.title, summary: n.summary, url: n.url, kind: n.kind, origin: 'seed', publishedAt: n.publishedAt, pinned: n.pinned, hidden: false },
      create: { id: n.id, vendorId: n.vendorId, technologyId: n.technologyId, title: n.title, summary: n.summary, url: n.url, kind: n.kind, origin: 'seed', publishedAt: n.publishedAt, pinned: n.pinned },
    });
  }

  console.log('Seed DEMO concluido.');
  console.log(`  Profissionais: ${professionals.length}`);
  console.log(`  Fabricantes:   ${vendors.length}`);
  console.log(`  Tecnologias:   ${technologies.length}`);
  console.log(`  Certificacoes: ${certifications.length}`);
  console.log(`  Certs. atribuidas: ${professionalCertifications.length}`);
  console.log(`  Itens de roadmap:  ${roadmapItems.length}`);
  console.log(`  Fontes Tec News:   ${newsSources.length}`);
  console.log(`  Novidades (DEMO):  ${newsItems.length}`);
  console.log('');
  console.log('Acessos DEMO:');
  console.log(`  ADMIN    -> ${adminEmail} / ${adminPassword}`);
  console.log('  MANAGER  -> maria.oliveira@suporte.local / Suporte@123');
  console.log('  CONSULTANT -> carlos.souza@suporte.local / Suporte@123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

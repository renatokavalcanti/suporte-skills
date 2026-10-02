/**
 * Limpeza controlada de dados (Suporte Skills).
 *
 * Remove os dados DEMO/ficticios para o go-live, preservando por padrao o
 * catalogo real (fabricantes, tecnologias, certificacoes, fontes do Tec News),
 * as releases e as configuracoes de IA. Ao final cria UM administrador.
 *
 * E DESTRUTIVO. Exige confirmacao explicita (CONFIRM_CLEAR=yes) e as
 * credenciais do admin. Uso:
 *
 *   CONFIRM_CLEAR=yes \
 *   ADMIN_NAME="Fulano" ADMIN_EMAIL="fulano@empresa.com" ADMIN_PASSWORD="..." \
 *   node prisma/clear-data.js
 *
 * Opcoes:
 *   CLEAR_CATALOG=yes  -> tambem apaga fabricantes/tecnologias/certificacoes
 *                         e as fontes do Tec News (comeca do zero)
 *   KEEP_CATALOG       (padrao) mantem o catalogo e as fontes
 *
 * NUNCA rode isto em ambiente com dados reais ja cadastrados sem backup.
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');

async function main() {
  if (process.env.CONFIRM_CLEAR !== 'yes') {
    console.error(
      '[ABORTADO] Defina CONFIRM_CLEAR=yes para confirmar a limpeza dos dados.',
    );
    process.exit(1);
  }

  const name = (process.env.ADMIN_NAME || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!name || !email || password.length < 6) {
    console.error(
      '[ABORTADO] Informe ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (>= 6 caracteres).',
    );
    process.exit(1);
  }

  const clearCatalog = process.env.CLEAR_CATALOG === 'yes';
  const prisma = new PrismaClient();

  try {
    // 1) Pessoas e tudo que depende delas (CASCADE): certificacoes atribuidas,
    //    roadmap, tokens de refresh, auditoria e estado de leitura do Tec News.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "professionals" RESTART IDENTITY CASCADE;',
    );

    // 2) Novidades DEMO (links ficticios) e resumos antigos.
    await prisma.newsItem.deleteMany({
      where: { OR: [{ origin: 'seed' }, { url: { startsWith: 'https://example.com/' } }] },
    });
    await prisma.newsDigest.deleteMany({});

    // 3) Catalogo (opcional): fabricantes/tecnologias/certificacoes e fontes.
    if (clearCatalog) {
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "news_sources", "certifications", "technologies", "vendors" RESTART IDENTITY CASCADE;',
      );
    }

    // 4) Administrador inicial com senha definitiva.
    const admin = await prisma.professional.create({
      data: {
        name,
        email,
        role: 'ADMIN',
        passwordHash: await hash(password),
        mustChangePassword: false,
        active: true,
        position: 'Administrador',
        notes: 'Administrador inicial',
      },
    });

    console.log('Limpeza concluida.');
    console.log(`  Catalogo: ${clearCatalog ? 'APAGADO' : 'preservado'}`);
    console.log(`  ADMIN criado: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

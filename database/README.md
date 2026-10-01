# database/

Artefatos de banco de dados auxiliares ao PostgreSQL do projeto.

- As **migrations** de schema ficam em `backend/prisma/migrations` (versionadas
  junto do código, via Prisma) — não duplicar aqui.
- Este diretório é reservado para:
  - scripts de inicialização/seed SQL pontuais;
  - rotinas de backup/restauração;
  - datasets de apoio para o ambiente local.

Nada é executado automaticamente pelo `docker-compose` a partir daqui no MVP.

import { OmitType } from '@nestjs/mapped-types';
import { CreateRoadmapItemDto } from './create-roadmap-item.dto';

/**
 * Criação via rota aninhada do perfil (D-026): o profissional e' fixado pela
 * rota (`/professionals/:id/roadmap`), entao nao vem no corpo. O servico aplica
 * o escopo do CONSULTANT e injeta o `professionalId`.
 */
export class CreateProfessionalRoadmapItemDto extends OmitType(
  CreateRoadmapItemDto,
  ['professionalId'] as const,
) {}

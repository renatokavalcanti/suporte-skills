import { Injectable } from '@nestjs/common';

/**
 * Formula de cobertura tecnologica, encapsulada para poder ser substituida
 * por um modelo de capacidade mais sofisticado sem impactar o restante.
 *
 * Definicao atual (D-010): percentual de profissionais ativos que possuem
 * ao menos uma certificacao EM VIGOR (ACTIVE, EXPIRING ou NO_EXPIRATION)
 * da tecnologia, sobre o total de profissionais ativos.
 */
@Injectable()
export class CoverageService {
  calculate(coveredProfessionals: number, totalActiveProfessionals: number): number {
    if (totalActiveProfessionals <= 0) {
      return 0;
    }
    const ratio = coveredProfessionals / totalActiveProfessionals;
    return Math.round(ratio * 1000) / 10;
  }
}

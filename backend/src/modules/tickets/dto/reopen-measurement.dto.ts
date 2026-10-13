import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ReopenMeasurementDto {
  /** Justificativa obrigatoria da reabertura (fica registrada na auditoria). */
  @IsString()
  @IsNotEmpty({ message: 'Informe a justificativa da reabertura' })
  @MinLength(3)
  @MaxLength(500)
  justification!: string;
}

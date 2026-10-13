import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMeasurementDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente' })
  @MaxLength(40)
  clientId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

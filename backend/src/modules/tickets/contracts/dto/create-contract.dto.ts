import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente' })
  clientId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do plano' })
  @MaxLength(160)
  planName!: string;

  /** Franquia mensal em minutos inteiros. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  includedMinutes!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  monthlyValue!: number;

  /** Valor da hora adicional (R$/hora). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  extraHourValue!: number;

  @IsIn(['EXPIRE', 'ACCUMULATE'])
  balancePolicy!: 'EXPIRE' | 'ACCUMULATE';

  @Matches(DATE_ONLY, { message: 'startDate deve ser YYYY-MM-DD' })
  startDate!: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endDate deve ser YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(200)
  financeEmail?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LinkUnmappedDto {
  /** Id local do cliente ao qual o chamado sera vinculado. */
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente' })
  @MaxLength(40)
  clientId!: string;
}

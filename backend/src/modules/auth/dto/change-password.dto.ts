import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Informe a senha atual' })
  @MinLength(6, { message: 'A senha atual deve ter ao menos 6 caracteres' })
  @MaxLength(128)
  currentPassword!: string;

  @IsString({ message: 'Informe a nova senha' })
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres' })
  @MaxLength(128)
  newPassword!: string;
}

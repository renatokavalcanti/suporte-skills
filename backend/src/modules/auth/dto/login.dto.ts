import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(255)
  email!: string;

  @IsString({ message: 'Informe a senha' })
  @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres' })
  @MaxLength(128)
  password!: string;
}

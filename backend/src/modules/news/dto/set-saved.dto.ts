import { IsBoolean } from 'class-validator';

export class SetSavedDto {
  @IsBoolean()
  saved!: boolean;
}

import { IsBoolean } from 'class-validator';

export class SetPinnedDto {
  @IsBoolean()
  pinned!: boolean;
}

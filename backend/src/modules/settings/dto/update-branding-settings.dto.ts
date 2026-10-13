import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class UpdateBrandingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'primaryColor deve ser #RRGGBB' })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'secondaryColor deve ser #RRGGBB' })
  secondaryColor?: string;

  /** Logo como data URL (data:image/png;base64,...). */
  @IsOptional()
  @IsString()
  @MaxLength(400000)
  logoDataUrl?: string;

  @IsOptional()
  @IsBoolean()
  clearLogo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  contactLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

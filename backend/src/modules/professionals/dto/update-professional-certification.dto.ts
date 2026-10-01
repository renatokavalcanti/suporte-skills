import { PartialType } from '@nestjs/mapped-types';
import { CreateProfessionalCertificationDto } from './create-professional-certification.dto';

export class UpdateProfessionalCertificationDto extends PartialType(
  CreateProfessionalCertificationDto,
) {}

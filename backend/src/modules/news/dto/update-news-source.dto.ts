import { PartialType } from '@nestjs/mapped-types';
import { CreateNewsSourceDto } from './create-news-source.dto';

export class UpdateNewsSourceDto extends PartialType(CreateNewsSourceDto) {}

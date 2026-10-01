import { PartialType } from '@nestjs/mapped-types';
import { CreateNewsItemDto } from './create-news-item.dto';

export class UpdateNewsItemDto extends PartialType(CreateNewsItemDto) {}

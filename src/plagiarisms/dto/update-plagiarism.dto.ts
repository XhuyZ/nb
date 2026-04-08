import { PartialType } from '@nestjs/swagger';
import { CreatePlagiarismDto } from './create-plagiarism.dto';

export class UpdatePlagiarismDto extends PartialType(CreatePlagiarismDto) {}

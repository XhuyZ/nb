import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionLanguage } from '../entities/submission.entity';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'assignment-uuid' })
  assignmentId: string;

  @ApiPropertyOptional({ example: 'function solve(){ return 1; }' })
  code?: string;

  @ApiPropertyOptional({
    enum: SubmissionLanguage,
    example: SubmissionLanguage.JAVASCRIPT,
  })
  language?: SubmissionLanguage;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewVerdict } from '../entities/plagiarism-review.entity';

export class ReviewVerdictDto {
  @ApiProperty({ enum: ReviewVerdict, example: ReviewVerdict.CONFIRMED_COPY })
  verdict: ReviewVerdict;

  @ApiPropertyOptional({ example: 'Code structure and variable naming are identical' })
  note?: string;
}

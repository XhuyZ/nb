import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssignmentTestCaseDto {
  @ApiProperty({ example: '1 2' })
  input: string;

  @ApiProperty({ example: '3' })
  expectedOutput: string;

  @ApiPropertyOptional({ example: true })
  isSample?: boolean;

  @ApiPropertyOptional({ example: 1 })
  weight?: number;
}

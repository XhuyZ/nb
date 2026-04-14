import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'NodeJS Backend 101' })
  name: string;

  @ApiPropertyOptional({ example: 'Khoa hoc backend cho sinh vien nam 2' })
  description?: string;
}

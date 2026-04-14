import { ApiProperty } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty({ example: 'Chuong 1 - Bien va Kieu du lieu' })
  title: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'student1' })
  username: string;

  @ApiProperty({ example: '123456' })
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: '123456' })
  oldPassword: string;

  @ApiProperty({ example: 'newStrongPassword123' })
  newPassword: string;
}


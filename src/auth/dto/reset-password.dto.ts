import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example:
      '9d9d0c5f6e5a4c8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  })
  token: string;

  @ApiProperty({ example: 'newStrongPassword123' })
  newPassword: string;
}


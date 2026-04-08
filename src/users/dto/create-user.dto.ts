import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'student6' })
  username: string;

  @ApiProperty({ example: '123456' })
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.STUDENT })
  role?: UserRole;

  @ApiPropertyOptional({ example: true })
  status?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus } from '../entities/assignment.entity';
import { CreateAssignmentTestCaseDto } from './create-assignment-test-case.dto';

export class CreateAssignmentDto {
  @ApiProperty({
    example: 'De bai 01 - Kiem tra chuoi doi xung',
    description: 'Tieu de de bai',
  })
  title: string;

  @ApiProperty({
    example: 'chapter-uuid',
    description: 'Chapter cua khoa hoc',
  })
  chapterId: string;

  @ApiProperty({
    example: 'Viet chuong trinh kiem tra palindrome',
    description: 'Chi tiet de bai',
  })
  description: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.000Z',
    description: 'Han nop bai (ISO date)',
  })
  deadline?: string;

  @ApiPropertyOptional({
    enum: AssignmentStatus,
    example: AssignmentStatus.OPEN,
    description: 'Trang thai bai tap',
  })
  status?: AssignmentStatus;

  @ApiPropertyOptional({
    example: 100,
    description: 'Thang diem toi da',
  })
  maxScore?: number;

  @ApiPropertyOptional({
    example: '- Dung test case\n- Toi uu thoi gian\n- Trinh bay code',
    description: 'Tieu chi danh gia',
  })
  evaluationCriteria?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Cho phep nop tre han',
  })
  allowLateSubmission?: boolean;

  @ApiPropertyOptional({
    type: [CreateAssignmentTestCaseDto],
    description: 'Danh sach test case',
  })
  testCases?: CreateAssignmentTestCaseDto[];
}

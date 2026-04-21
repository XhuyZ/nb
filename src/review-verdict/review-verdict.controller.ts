import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { ReviewVerdictDto } from './dto/review-verdict.dto';
import { ReviewVerdictService } from './review-verdict.service';

@ApiTags('review-verdict')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('review-verdict')
export class ReviewVerdictController {
  constructor(private readonly reviewService: ReviewVerdictService) {}

  @Get('high-risk')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Loc bai nop rui ro cao' })
  getHighRisk(@Query('courseId') courseId?: string) {
    return this.reviewService.getHighRiskSubmissions(courseId);
  }

  @Get(':submissionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem chi tiet ra soat va chuoi bang chung' })
  getReviewDetails(
    @Param('submissionId') submissionId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.reviewService.getReviewDetails(
      submissionId,
      req.user.sub,
      req.user.role,
    );
  }

  @Patch(':submissionId/verdict')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Dat ket luan cuoi cung cho bai nop' })
  @ResponseMessage('Review verdict updated successfully')
  setVerdict(
    @Param('submissionId') submissionId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: ReviewVerdictDto,
  ) {
    return this.reviewService.upsertVerdict(
      submissionId,
      req.user.sub,
      req.user.role,
      dto,
    );
  }
}

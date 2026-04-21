import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { ReportType } from './entities/academic-report.entity';
import { StatisticsReportingService } from './statistics-reporting.service';

@ApiTags('statistics-reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('statistics-reporting')
export class StatisticsReportingController {
  constructor(private readonly reportingService: StatisticsReportingService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Tong hop phan tich du lieu' })
  getOverview(@Query('courseId') courseId?: string) {
    return this.reportingService.getOverview(courseId);
  }

  @Get('visualization')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Du lieu bieu do phan bo va xu huong' })
  getVisualization(@Query('courseId') courseId?: string) {
    return this.reportingService.getVisualizationData(courseId);
  }

  @Post('export-pdf')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Sinh va xuat bao cao PDF' })
  @ResponseMessage('PDF report exported successfully')
  exportPdf(
    @Req() req: { user: { sub: string } },
    @Body() body: { type?: ReportType; courseId?: string },
  ) {
    return this.reportingService.exportPdfReport(
      req.user.sub,
      body.type ?? ReportType.ACADEMIC_INTEGRITY,
      body.courseId,
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher tao khoa hoc' })
  @ResponseMessage('Course created successfully')
  createCourse(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach khoa hoc, co filter giao vien' })
  @ApiQuery({
    name: 'teacherId',
    required: false,
    type: String,
    description: 'Optional teacher id to filter courses',
  })
  listCourses(@Query('teacherId') teacherId?: string) {
    return this.coursesService.listCourses(teacherId);
  }

  @Get('my/enrolled')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student xem khoa hoc da tham gia' })
  listMyEnrolledCourses(@Req() req: { user: { sub: string } }) {
    return this.coursesService.listEnrolledCourses(req.user.sub);
  }

  @Get('my/assignments')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student view assignments in enrolled courses' })
  @ApiQuery({
    name: 'courseId',
    required: false,
    type: String,
    description: 'Optional course id to filter assignments',
  })
  @ResponseMessage('Enrolled course assignments retrieved successfully')
  listMyAssignments(
    @Req() req: { user: { sub: string } },
    @Query('courseId') courseId?: string,
  ) {
    return this.coursesService.listAssignmentsForStudent(req.user.sub, courseId);
  }

  @Get('my/teaching')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher xem khoa hoc dang day' })
  listMyTeachingCourses(@Req() req: { user: { sub: string } }) {
    return this.coursesService.listTeachingCourses(req.user.sub);
  }

  @Post(':id/enroll')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student tham gia khoa hoc' })
  @ResponseMessage('Joined course successfully')
  enrollCourse(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.coursesService.enrollCourse(id, req.user.sub);
  }

  @Post(':id/chapters')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher tao chuong trong khoa hoc' })
  @ResponseMessage('Chapter created successfully')
  createChapter(
    @Param('id') courseId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateChapterDto,
  ) {
    return this.coursesService.createChapter(courseId, req.user.sub, dto);
  }

  @Get(':id/chapters')
  @ApiOperation({ summary: 'Lay danh sach chuong cua khoa hoc' })
  listChapters(@Param('id') id: string) {
    return this.coursesService.listChapters(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay chi tiet khoa hoc' })
  getCourse(@Param('id') id: string) {
    return this.coursesService.getCourseById(id);
  }
}

import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/users/entities/user.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';

type RequestUser = {
  sub: string;
  role: UserRole;
};

@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student nop bai moi hoac nop lai' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['assignmentId'],
      properties: {
        assignmentId: { type: 'string' },
        code: { type: 'string' },
        language: { type: 'string', enum: ['javascript', 'python'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ResponseMessage('Nop bai thanh cong')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadPath = join(process.cwd(), 'uploads');
          mkdirSync(uploadPath, { recursive: true });
          callback(null, uploadPath);
        },
        filename: (_req, file, callback) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${suffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        const allowedExtensions = ['.zip', '.py', '.js', '.ts', '.java', '.cpp'];
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          callback(
            new BadRequestException(
              'Only zip, py, js, ts, java, cpp are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Req() req: { user: RequestUser; protocol: string; headers: { host: string } },
    @Body() createSubmissionDto: CreateSubmissionDto,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      path: string;
      filename: string;
    },
  ) {
    return this.submissionsService.submit(
      req.user.sub,
      createSubmissionDto,
      file,
      req.headers.host,
      req.protocol,
    );
  }

  @Get()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student xem bai da nop' })
  @ResponseMessage('Lay bai nop thanh cong')
  findMine(@Req() req: { user: RequestUser }) {
    return this.submissionsService.findByStudent(req.user.sub);
  }

  @Get('all')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher/Admin xem toan bo bai nop' })
  findAllForTeacher() {
    return this.submissionsService.findAll();
  }

  @Get('assignment/:assignmentId')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher xem bai nop theo assignment' })
  findByAssignment(
    @Req() req: { user: RequestUser },
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.submissionsService.findByAssignmentForTeacher(
      req.user.sub,
      assignmentId,
    );
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Xem lich su phien ban nop' })
  findVersions(@Req() req: { user: RequestUser }, @Param('id') id: string) {
    return this.submissionsService.findVersions(
      id,
      req.user.sub,
      req.user.role,
    );
  }

  @Get(':id/plagiarism')
  @ApiOperation({ summary: 'Xem canh bao dao code' })
  findPlagiarism(@Req() req: { user: RequestUser }, @Param('id') id: string) {
    return this.submissionsService.findPlagiarism(
      id,
      req.user.sub,
      req.user.role,
    );
  }

  @Get(':id/plagiarism/stats')
  @ApiOperation({ summary: 'Thong ke va bang chung dao code' })
  findPlagiarismStatistics(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.submissionsService.findPlagiarismStatistics(
      id,
      req.user.sub,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay chi tiet bai nop' })
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat bai nop' })
  update(@Param('id') id: string, @Body() updateSubmissionDto: UpdateSubmissionDto) {
    return this.submissionsService.update(id, updateSubmissionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoa bai nop' })
  remove(@Param('id') id: string) {
    return this.submissionsService.remove(id);
  }
}

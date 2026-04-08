import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
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
import { AssignmentStatus } from './entities/assignment.entity';

type RequestUser = {
  sub: string;
  role?: UserRole;
};

@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher tao assignment moi' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'description'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deadline: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['draft', 'open', 'closed'] },
        maxScore: { type: 'number' },
        evaluationCriteria: { type: 'string' },
        allowLateSubmission: { type: 'boolean' },
        testCases: {
          type: 'string',
          example:
            '[{\"input\":\"1 2\",\"expectedOutput\":\"3\",\"isSample\":true,\"weight\":1}]',
        },
        document: { type: 'string', format: 'binary' },
      },
    },
  })
  @ResponseMessage('Tao assignment thanh cong')
  @UseInterceptors(
    FileInterceptor('document', {
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
      fileFilter: (_req, file, callback) => {
        const allowedExtensions = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          callback(
            new BadRequestException(
              'Only pdf, docx, jpg, jpeg, png are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  create(
    @Req() req: { user: RequestUser; protocol: string; headers: { host: string } },
    @Body() createAssignmentDto: CreateAssignmentDto,
    @UploadedFile() file?: { filename: string },
  ) {
    const normalizedDto = this.normalizeCreateAssignmentDto(createAssignmentDto);
    const document = file
      ? `${req.protocol}://${req.headers.host}/uploads/${file.filename}`
      : undefined;

    return this.assignmentsService.createByTeacher(
      req.user.sub,
      normalizedDto,
      document,
    );
  }

  @Get()
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher lay assignment da tao' })
  @ResponseMessage('Lay danh sach assignment thanh cong')
  findMine(@Req() req: { user: RequestUser }) {
    return this.assignmentsService.findByTeacher(req.user.sub);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Lay tat ca tai lieu he thong' })
  @ResponseMessage('Lay danh sach tai lieu thanh cong')
  findDocuments() {
    return this.assignmentsService.findAllDocuments();
  }

  @Post(':id/documents')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher them tai lieu cho assignment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['document'],
      properties: {
        document: { type: 'string', format: 'binary' },
      },
    },
  })
  @ResponseMessage('Them tai lieu thanh cong')
  @UseInterceptors(
    FileInterceptor('document', {
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
      fileFilter: (_req, file, callback) => {
        const allowedExtensions = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          callback(
            new BadRequestException(
              'Only pdf, docx, jpg, jpeg, png are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  addDocument(
    @Param('id') id: string,
    @Req() req: { user: RequestUser; protocol: string; headers: { host: string } },
    @UploadedFile() file?: {
      filename: string;
      originalname: string;
      size: number;
      mimetype: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }
    return this.assignmentsService.addDocument(id, req.user.sub, {
      fileName: file.originalname,
      fileUrl: `${req.protocol}://${req.headers.host}/uploads/${file.filename}`,
      fileSize: file.size,
      fileMimeType: file.mimetype,
    });
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Lay tai lieu theo assignment' })
  getAssignmentDocuments(@Param('id') id: string) {
    return this.assignmentsService.getAssignmentDocuments(id);
  }

  @Get(':id/test-cases')
  @ApiOperation({ summary: 'Lay test case cua assignment' })
  getAssignmentTestCases(
    @Param('id') id: string,
    @Req() req: { user: { role?: UserRole } },
  ) {
    const showHidden =
      req.user?.role === UserRole.TEACHER || req.user?.role === UserRole.ADMIN;
    return this.assignmentsService.getAssignmentTestCases(id, showHidden);
  }

  @Get('all')
  @ApiOperation({ summary: 'Moi role lay tat ca assignment' })
  findAll() {
    return this.assignmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay chi tiet assignment' })
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher cap nhat assignment' })
  update(
    @Param('id') id: string,
    @Req() req: { user: RequestUser },
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(id, req.user.sub, updateAssignmentDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher cap nhat vong doi assignment' })
  @ResponseMessage('Cap nhat trang thai assignment thanh cong')
  updateStatus(
    @Param('id') id: string,
    @Req() req: { user: RequestUser },
    @Body() body: { status: AssignmentStatus },
  ) {
    return this.assignmentsService.updateStatus(id, req.user.sub, body.status);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher xoa assignment' })
  remove(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.assignmentsService.remove(id, req.user.sub);
  }

  private normalizeCreateAssignmentDto(
    dto: CreateAssignmentDto,
  ): CreateAssignmentDto {
    if (typeof (dto as unknown as { testCases?: string }).testCases === 'string') {
      try {
        return {
          ...dto,
          testCases: JSON.parse(
            (dto as unknown as { testCases: string }).testCases,
          ) as CreateAssignmentDto['testCases'],
        };
      } catch {
        throw new BadRequestException('Invalid testCases JSON');
      }
    }
    return dto;
  }
}

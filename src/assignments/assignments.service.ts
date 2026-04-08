import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Assignment, AssignmentStatus } from './entities/assignment.entity';
import { Not, IsNull, Repository } from 'typeorm';
import { User, UserRole } from 'src/users/entities/user.entity';
import { AssignmentDocument } from './entities/assignment-document.entity';
import { AssignmentTestCase } from './entities/assignment-test-case.entity';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentsRepository: Repository<Assignment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AssignmentDocument)
    private readonly assignmentDocumentsRepository: Repository<AssignmentDocument>,
    @InjectRepository(AssignmentTestCase)
    private readonly assignmentTestCasesRepository: Repository<AssignmentTestCase>,
  ) {}

  async createByTeacher(
    teacherId: string,
    createAssignmentDto: CreateAssignmentDto,
    document?: string,
  ) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher account not found');
    }

    const assignment = this.assignmentsRepository.create({
      teacher,
      title: createAssignmentDto.title,
      description: createAssignmentDto.description,
      deadline: createAssignmentDto.deadline
        ? new Date(createAssignmentDto.deadline)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: createAssignmentDto.status ?? AssignmentStatus.OPEN,
      maxScore: createAssignmentDto.maxScore ?? 100,
      evaluationCriteria: createAssignmentDto.evaluationCriteria,
      allowLateSubmission: createAssignmentDto.allowLateSubmission ?? false,
      document,
    });

    const saved = await this.assignmentsRepository.save(assignment);
    await this.saveAssignmentTestCases(saved.id, createAssignmentDto.testCases ?? []);
    return this.toAssignmentResponse({
      ...saved,
      teacher,
    } as Assignment);
  }

  findAll() {
    return this.assignmentsRepository.find({
      relations: {
        teacher: true,
        testCases: true,
      },
      order: {
        created_at: 'DESC',
      },
    }).then((items) => items.map((item) => this.toAssignmentResponse(item)));
  }

  async findByTeacher(teacherId: string) {
    return this.assignmentsRepository.find({
      where: { teacher: { id: teacherId } },
      relations: {
        teacher: true,
        testCases: true,
      },
      order: {
        created_at: 'DESC',
      },
    }).then((items) => items.map((item) => this.toAssignmentResponse(item)));
  }

  async findAllDocuments() {
    const assignmentDocuments = await this.assignmentDocumentsRepository.find({
      relations: {
        assignment: true,
        uploadedBy: true,
      },
      order: {
        created_at: 'DESC',
      },
    });

    const mainDocuments = await this.assignmentsRepository.find({
      where: {
        document: Not(IsNull()),
      },
      relations: {
        teacher: true,
        testCases: true,
      },
      order: {
        created_at: 'DESC',
      },
    });

    return [
      ...mainDocuments.map((item) => ({
        assignmentId: item.id,
        assignmentTitle: item.title,
        uploadedBy: item.teacher?.username ?? null,
        fileName: item.document?.split('/').pop() ?? null,
        fileUrl: item.document,
        createdAt: item.created_at,
      })),
      ...assignmentDocuments.map((doc) => ({
        assignmentId: doc.assignment?.id,
        assignmentTitle: doc.assignment?.title,
        uploadedBy: doc.uploadedBy?.username ?? null,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        createdAt: doc.created_at,
      })),
    ];
  }

  async findOne(id: string) {
    const assignment = await this.getAssignmentEntity(id);
    return this.toAssignmentResponse(assignment);
  }

  async update(id: string, teacherId: string, updateAssignmentDto: UpdateAssignmentDto) {
    const assignment = await this.getAssignmentEntity(id);
    this.ensureOwner(assignment, teacherId);
    Object.assign(assignment, updateAssignmentDto);
    if (updateAssignmentDto.deadline) {
      assignment.deadline = new Date(updateAssignmentDto.deadline);
    }
    const updated = await this.assignmentsRepository.save(assignment);
    if (updateAssignmentDto.testCases) {
      await this.assignmentTestCasesRepository.delete({
        assignment: { id: updated.id },
      });
      await this.saveAssignmentTestCases(updated.id, updateAssignmentDto.testCases);
    }
    return this.toAssignmentResponse(updated);
  }

  async updateStatus(id: string, teacherId: string, status: AssignmentStatus) {
    const assignment = await this.getAssignmentEntity(id);
    this.ensureOwner(assignment, teacherId);
    assignment.status = status;
    const updated = await this.assignmentsRepository.save(assignment);
    return this.toAssignmentResponse(updated);
  }

  async addDocument(
    assignmentId: string,
    teacherId: string,
    payload: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      fileMimeType: string;
    },
  ) {
    const assignment = await this.getAssignmentEntity(assignmentId);
    this.ensureOwner(assignment, teacherId);
    const teacher = await this.usersRepository.findOne({ where: { id: teacherId } });

    const document = this.assignmentDocumentsRepository.create({
      assignment,
      uploadedBy: teacher ?? undefined,
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      fileSize: payload.fileSize,
      mimeType: payload.fileMimeType,
    });
    return this.assignmentDocumentsRepository.save(document);
  }

  async getAssignmentDocuments(assignmentId: string) {
    await this.getAssignmentEntity(assignmentId);
    return this.assignmentDocumentsRepository.find({
      where: {
        assignment: {
          id: assignmentId,
        },
      },
      relations: {
        uploadedBy: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async getAssignmentTestCases(
    assignmentId: string,
    showHidden: boolean,
  ) {
    await this.getAssignmentEntity(assignmentId);
    const where = showHidden
      ? { assignment: { id: assignmentId } }
      : { assignment: { id: assignmentId }, isSample: true };
    return this.assignmentTestCasesRepository.find({
      where,
      order: {
        orderIndex: 'ASC',
      },
    });
  }

  async remove(id: string, teacherId: string) {
    const assignment = await this.getAssignmentEntity(id);
    this.ensureOwner(assignment, teacherId);
    await this.assignmentsRepository.remove(assignment);
    return { id };
  }

  private async getAssignmentEntity(id: string) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
      relations: {
        teacher: true,
        testCases: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  private toAssignmentResponse(assignment: Assignment) {
    return {
      id: assignment.id,
      teacher: assignment.teacher
        ? {
            id: assignment.teacher.id,
            username: assignment.teacher.username,
            role: assignment.teacher.role,
          }
        : null,
      title: assignment.title,
      description: assignment.description,
      document: assignment.document,
      deadline: assignment.deadline,
      status: assignment.status,
      maxScore: assignment.maxScore,
      evaluationCriteria: assignment.evaluationCriteria,
      allowLateSubmission: assignment.allowLateSubmission,
      testCases: (assignment.testCases ?? []).map((testCase) => ({
        id: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.isSample ? testCase.expectedOutput : undefined,
        isSample: testCase.isSample,
        weight: testCase.weight,
        orderIndex: testCase.orderIndex,
      })),
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    };
  }

  private ensureOwner(assignment: Assignment, teacherId: string) {
    if (assignment.teacher?.id !== teacherId) {
      throw new ForbiddenException('You can only manage your assignments');
    }
  }

  private async saveAssignmentTestCases(
    assignmentId: string,
    testCases: CreateAssignmentDto['testCases'],
  ) {
    if (!testCases || testCases.length === 0) {
      return;
    }
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      return;
    }
    const entities = testCases.map((item, index) =>
      this.assignmentTestCasesRepository.create({
        assignment,
        input: item.input,
        expectedOutput: item.expectedOutput,
        isSample: item.isSample ?? false,
        weight: item.weight ?? 1,
        orderIndex: index + 1,
      }),
    );
    await this.assignmentTestCasesRepository.save(entities);
  }
}

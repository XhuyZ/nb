import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import {
  ProcessingStatus,
  Submission,
  SubmissionLanguage,
  SubmissionStatus,
} from './entities/submission.entity';
import { Repository } from 'typeorm';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { CourseMember } from 'src/courses/entities/course-member.entity';
import {
  SubmitVersion,
  SubmitVersionStatus,
} from 'src/submit-versions/entities/submit-version.entity';
import { Plagiarism, EvidenceSegment } from 'src/plagiarisms/entities/plagiarism.entity';
import { PlagiarismExtractor } from 'src/common/utils/plagiarism-extractor.util';
import { User, UserRole } from 'src/users/entities/user.entity';
import { SubmissionTestResult } from './entities/submission-test-result.entity';
import { spawn } from 'child_process';

@Injectable()
export class SubmissionsService {
  private readonly highRiskThreshold = 0.7;
  private readonly judgeTimeoutMs = 2500;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepository: Repository<Assignment>,
    @InjectRepository(AssignmentTestCase)
    private readonly assignmentTestCasesRepository: Repository<AssignmentTestCase>,
    @InjectRepository(CourseMember)
    private readonly courseMembersRepository: Repository<CourseMember>,
    @InjectRepository(SubmitVersion)
    private readonly submitVersionsRepository: Repository<SubmitVersion>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismsRepository: Repository<Plagiarism>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(SubmissionTestResult)
    private readonly submissionTestResultsRepository: Repository<SubmissionTestResult>,
  ) { }

  async submit(
    studentId: string,
    createSubmissionDto: CreateSubmissionDto,
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      path: string;
      filename: string;
    },
    host?: string,
    protocol?: string,
  ) {
    const student = await this.usersRepository.findOne({
      where: {
        id: studentId,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const assignment = await this.assignmentsRepository.findOne({
      where: { id: createSubmissionDto.assignmentId },
      relations: {
        teacher: true,
        chapter: {
          course: true,
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (!createSubmissionDto.code && !file) {
      throw new BadRequestException('Code or file is required');
    }

    const courseId = assignment.chapter?.course?.id;
    if (!courseId) {
      throw new ForbiddenException('Assignment has no course chapter');
    }
    const member = await this.courseMembersRepository.findOne({
      where: {
        course: { id: courseId },
        student: { id: studentId },
        active: true,
      },
    });
    if (!member) {
      throw new ForbiddenException('Join course before submitting assignment');
    }

    if (assignment.status !== 'open') {
      throw new ForbiddenException('Assignment is not open for submission');
    }

    const now = new Date();
    const isLate = now.getTime() > assignment.deadline.getTime();
    if (isLate && !assignment.allowLateSubmission) {
      throw new ForbiddenException('Deadline has passed, submission is locked');
    }

    let submission = await this.submissionsRepository.findOne({
      where: {
        student: { id: studentId },
        assignment: { id: assignment.id },
      },
      relations: {
        student: true,
        assignment: {
          chapter: {
            course: true,
          },
        },
        versions: true,
        testResults: {
          testCase: true,
          submitVersion: true,
        },
      },
    });

    if (!submission) {
      submission = this.submissionsRepository.create({
        student,
        assignment,
        code: createSubmissionDto.code ?? '',
        file: file && host && protocol ? `${protocol}://${host}/uploads/${file.filename}` : undefined,
        language: createSubmissionDto.language ?? SubmissionLanguage.JAVASCRIPT,
        status: SubmissionStatus.SUBMITTED,
        versionCount: 0,
        lastSubmittedAt: now,
      });
    }

    const latestVersion = await this.submitVersionsRepository.findOne({
      where: {
        submission: { id: submission.id },
      },
      order: {
        version: 'DESC',
      },
    });
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    if (latestVersion) {
      latestVersion.status = SubmitVersionStatus.ARCHIVED;
      await this.submitVersionsRepository.save(latestVersion);
    }

    const codeSnapshot = createSubmissionDto.code ?? submission.code;
    const fileUrl =
      file && host && protocol ? `${protocol}://${host}/uploads/${file.filename}` : undefined;
    const savedSubmission = await this.submissionsRepository.save({
      ...submission,
      code: codeSnapshot,
      file: fileUrl ?? submission.file,
      language: createSubmissionDto.language ?? submission.language,
      status: SubmissionStatus.SUBMITTED,
      versionCount: nextVersion,
      lastSubmittedAt: now,
      judgeStatus: ProcessingStatus.PROCESSING,
      plagiarismStatus: ProcessingStatus.PROCESSING,
    });

    const version = await this.submitVersionsRepository.save(
      this.submitVersionsRepository.create({
        submission: savedSubmission,
        version: nextVersion,
        codeSnapshot,
        fileUrl,
        fileName: file?.originalname,
        fileMimeType: file?.mimetype,
        fileSize: file?.size,
        submittedAt: now,
        status: SubmitVersionStatus.ACTIVE,
      }),
    );

    this.processSubmissionAsync(savedSubmission.id, version.id).catch(() => undefined);
    const refreshed = await this.getSubmissionEntity(savedSubmission.id);
    return this.toSubmissionResponse(refreshed);
  }

  findAll() {
    return this.submissionsRepository.find({
      relations: {
        student: true,
        assignment: {
          chapter: {
            course: true,
          },
        },
        versions: true,
        testResults: {
          testCase: true,
          submitVersion: true,
        },
      },
      order: {
        created_at: 'DESC',
      },
    }).then((items) => Promise.all(items.map((item) => this.toSubmissionResponse(item))));
  }

  findByStudent(studentId: string) {
    return this.submissionsRepository.find({
      where: {
        student: {
          id: studentId,
        },
      },
      relations: {
        student: true,
        assignment: true,
        versions: true,
        testResults: {
          testCase: true,
          submitVersion: true,
        },
      },
      order: {
        created_at: 'DESC',
      },
    }).then((items) => Promise.all(items.map((item) => this.toSubmissionResponse(item))));
  }

  async findOne(id: string) {
    const submission = await this.getSubmissionEntity(id);
    return this.toSubmissionResponse(submission);
  }

  async findByAssignmentForTeacher(teacherId: string, assignmentId: string) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: { teacher: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.teacher?.id !== teacherId) {
      throw new ForbiddenException('You can only view submissions of your assignments');
    }

    const submissions = await this.submissionsRepository.find({
      where: { assignment: { id: assignmentId } },
      relations: {
        student: true,
        assignment: {
          chapter: {
            course: true,
          },
        },
      },
      order: { created_at: 'DESC' },
    });
    return Promise.all(submissions.map((item) => this.toSubmissionResponse(item)));
  }

  async findVersions(submissionId: string, requesterId: string, role: UserRole) {
    const submission = await this.getSubmissionEntity(submissionId);
    if (role === UserRole.STUDENT && submission.student?.id !== requesterId) {
      throw new ForbiddenException('Cannot view versions of other students');
    }
    if (role === UserRole.TEACHER && submission.assignment?.teacher?.id !== requesterId) {
      throw new ForbiddenException('Cannot view versions outside your assignment');
    }

    return this.submitVersionsRepository.find({
      where: { submission: { id: submissionId } },
      order: { version: 'DESC' },
    });
  }

  async findPlagiarism(submissionId: string, requesterId: string, role: UserRole) {
    const submission = await this.getSubmissionEntity(submissionId);
    if (role === UserRole.STUDENT && submission.student?.id !== requesterId) {
      throw new ForbiddenException('Cannot view plagiarism of other students');
    }
    if (role === UserRole.TEACHER && submission.assignment?.teacher?.id !== requesterId) {
      throw new ForbiddenException('Cannot view plagiarism outside your assignment');
    }

    const versions = await this.submitVersionsRepository.find({
      where: { submission: { id: submissionId }, status: SubmitVersionStatus.ACTIVE },
    });
    if (versions.length === 0) {
      return [];
    }

    const versionIds = versions.map((item) => item.id);
    return this.plagiarismsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.submitVersionA', 'a')
      .leftJoinAndSelect('p.submitVersionB', 'b')
      .where('a.id IN (:...versionIds)', { versionIds })
      .orWhere('b.id IN (:...versionIds)', { versionIds })
      .orderBy('p.similarity', 'DESC')
      .getMany();
  }

  async findPlagiarismStatistics(
    submissionId: string,
    requesterId: string,
    role: UserRole,
  ) {
    const matches = await this.findPlagiarism(submissionId, requesterId, role);
    const submission = await this.getSubmissionEntity(submissionId);

    return {
      submissionId,
      student: submission.student
        ? {
          id: submission.student.id,
          username: submission.student.username,
        }
        : null,
      highestSimilarity: submission.highestSimilarity ?? 0,
      highRiskCount: matches.filter((item) => item.highRisk).length,
      matches: matches.map((item) => ({
        plagiarismId: item.id,
        similarity: item.similarity,
        highRisk: item.highRisk,
        submitVersionAId: item.submitVersionA?.id,
        submitVersionBId: item.submitVersionB?.id,
        evidence: item.evidence ?? { commonTokens: [], commonLines: [] },
      })),
    };
  }

  async update(id: string, updateSubmissionDto: UpdateSubmissionDto) {
    const submission = await this.getSubmissionEntity(id);
    Object.assign(submission, updateSubmissionDto);
    const updated = await this.submissionsRepository.save(submission);
    return this.toSubmissionResponse(updated);
  }

  async remove(id: string) {
    const submission = await this.getSubmissionEntity(id);
    await this.submissionsRepository.remove(submission);
    return { id };
  }

  private async getSubmissionEntity(id: string) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: {
        student: true,
        assignment: {
          teacher: true,
          chapter: {
            course: true,
          },
        },
        versions: true,
        testResults: {
          testCase: true,
          submitVersion: true,
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  private async toSubmissionResponse(submission: Submission) {
    const latestTestResults = await this.latestResultsForSubmission(submission);
    return {
      id: submission.id,
      student: submission.student
        ? {
          id: submission.student.id,
          username: submission.student.username,
          role: submission.student.role,
        }
        : null,
      assignment: submission.assignment
        ? {
          id: submission.assignment.id,
          title: submission.assignment.title,
          description: submission.assignment.description,
          document: submission.assignment.document,
          deadline: submission.assignment.deadline,
          maxScore: submission.assignment.maxScore,
          evaluationCriteria: submission.assignment.evaluationCriteria,
          allowLateSubmission: submission.assignment.allowLateSubmission,
          status: submission.assignment.status,
          chapter: submission.assignment.chapter
            ? {
              id: submission.assignment.chapter.id,
              title: submission.assignment.chapter.title,
              course: submission.assignment.chapter.course
                ? {
                  id: submission.assignment.chapter.course.id,
                  name: submission.assignment.chapter.course.name,
                }
                : null,
            }
            : null,
          created_at: submission.assignment.created_at,
          updated_at: submission.assignment.updated_at,
        }
        : null,
      code: submission.code,
      file: submission.file,
      language: submission.language,
      score: submission.score,
      status: submission.status,
      versionCount: submission.versionCount,
      lastSubmittedAt: submission.lastSubmittedAt,
      highestSimilarity: submission.highestSimilarity,
      plagiarismFlag: submission.plagiarismFlag,
      passRate: submission.passRate,
      judgeStatus: submission.judgeStatus,
      plagiarismStatus: submission.plagiarismStatus,
      latestTestResults,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
    };
  }

  private async processSubmissionAsync(submissionId: string, versionId: string) {
    const submission = await this.getSubmissionEntity(submissionId);
    const version = await this.submitVersionsRepository.findOne({
      where: { id: versionId },
      relations: { submission: { assignment: true } },
    });
    if (!version) {
      return;
    }

    try {
      await this.judgeSubmission(submission, version);
      submission.judgeStatus = ProcessingStatus.COMPLETED;
    } catch {
      submission.judgeStatus = ProcessingStatus.FAILED;
    }

    try {
      await this.detectPlagiarism(submission, version);
      submission.plagiarismStatus = ProcessingStatus.COMPLETED;
    } catch {
      submission.plagiarismStatus = ProcessingStatus.FAILED;
    }

    await this.submissionsRepository.save(submission);
  }

  private async judgeSubmission(submission: Submission, version: SubmitVersion) {
    const testCases = await this.assignmentTestCasesRepository.find({
      where: { assignment: { id: submission.assignment.id } },
      order: { orderIndex: 'ASC' },
    });

    await this.submissionTestResultsRepository.delete({
      submitVersion: { id: version.id },
    });

    if (testCases.length === 0) {
      submission.passRate = 0;
      submission.score = 0;
      submission.status = SubmissionStatus.GRADED;
      await this.submissionsRepository.save(submission);
      return;
    }

    let passWeight = 0;
    let totalWeight = 0;
    const results: SubmissionTestResult[] = [];

    for (const testCase of testCases) {
      totalWeight += testCase.weight;
      const startedAt = Date.now();
      const execution = await this.executeJavascript(
        version.codeSnapshot ?? submission.code,
        testCase.input,
      );
      const actual = this.normalizeOutput(execution.output);
      const expected = this.normalizeOutput(testCase.expectedOutput);
      const passed = execution.success && actual === expected;
      if (passed) {
        passWeight += testCase.weight;
      }

      results.push(
        this.submissionTestResultsRepository.create({
          submission,
          submitVersion: version,
          testCase,
          passed,
          actualOutput: execution.success ? actual : undefined,
          errorMessage: execution.success ? undefined : execution.error,
          executionTimeMs: Date.now() - startedAt,
        }),
      );
    }

    await this.submissionTestResultsRepository.save(results);

    const passRate =
      totalWeight === 0 ? 0 : Number(((passWeight / totalWeight) * 100).toFixed(2));
    submission.passRate = passRate;
    submission.score = Math.round((submission.assignment.maxScore * passRate) / 100);
    submission.status = SubmissionStatus.GRADED;
    await this.submissionsRepository.save(submission);
  }

  private async detectPlagiarism(submission: Submission, version: SubmitVersion) {
    const activeVersions = await this.submitVersionsRepository.find({
      where: {
        status: SubmitVersionStatus.ACTIVE,
      },
      relations: {
        submission: {
          assignment: true,
          student: true,
        },
      },
    });

    const sameAssignmentOtherVersions = activeVersions.filter(
      (item) =>
        item.submission?.assignment?.id === submission.assignment?.id &&
        item.submission?.student?.id !== submission.student?.id,
    );

    let highestSimilarity = 0;

    for (const other of sameAssignmentOtherVersions) {
      const similarity = this.computeSimilarity(
        version.codeSnapshot ?? '',
        other.codeSnapshot ?? '',
      );

      if (similarity <= 0) {
        continue;
      }
      await this.plagiarismsRepository.save(
        this.plagiarismsRepository.create({
          submitVersionA: version,
          submitVersionB: other,
          similarity,
          highRisk: similarity >= this.highRiskThreshold,
          evidence: PlagiarismExtractor.extractPlagiarismEvidence(
            version.codeSnapshot ?? '',
            other.codeSnapshot ?? '',
          ),
        }),
      );
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
      }
    }

    submission.highestSimilarity = highestSimilarity > 0 ? highestSimilarity : undefined;
    submission.plagiarismFlag = highestSimilarity >= this.highRiskThreshold;
    await this.submissionsRepository.save(submission);
  }

  private async executeJavascript(code: string, input: string) {
    return new Promise<{ success: boolean; output?: string; error?: string }>((resolve) => {
      const runnerScript = `
const vm = require('vm');
let body = '';
process.stdin.on('data', (chunk) => { body += chunk; });
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(body);
    const sandbox = { module: { exports: {} }, exports: {}, console: { log: () => undefined }, Promise };
    vm.createContext(sandbox);
    vm.runInContext(payload.code, sandbox, { timeout: ${this.judgeTimeoutMs} });
    const solve = sandbox.solve || sandbox.module.exports.solve || (typeof sandbox.module.exports === 'function' ? sandbox.module.exports : null);
    if (typeof solve !== 'function') {
      throw new Error('Missing solve(input) function');
    }
    const output = await Promise.resolve(solve(payload.input));
    process.stdout.write(JSON.stringify({ success: true, output: String(output ?? '') }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ success: false, error: error.message }));
  }
});
`;

      const child = spawn(process.execPath, ['-e', runnerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ success: false, error: 'Execution timeout' });
      }, this.judgeTimeoutMs + 500);

      child.on('close', () => {
        clearTimeout(timeout);
        if (!stdout) {
          resolve({ success: false, error: stderr || 'Runtime error' });
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({ success: false, error: 'Invalid runtime output' });
        }
      });

      child.stdin.write(JSON.stringify({ code, input }));
      child.stdin.end();
    });
  }

  private computeSimilarity(a: string, b: string): number {
    const astA = PlagiarismExtractor.extractAstFeatures(a);
    const astB = PlagiarismExtractor.extractAstFeatures(b);
    const tokensA = new Set([...this.normalizeCode(a), ...astA.identifiers, ...astA.nodeTypes]);
    const tokensB = new Set([...this.normalizeCode(b), ...astB.identifiers, ...astB.nodeTypes]);

    if (tokensA.size === 0 || tokensB.size === 0) {
      return 0;
    }

    let intersectionCount = 0;
    tokensA.forEach((token) => {
      if (tokensB.has(token)) {
        intersectionCount += 1;
      }
    });

    const unionCount = new Set([...tokensA, ...tokensB]).size;
    if (unionCount === 0) {
      return 0;
    }

    return Number((intersectionCount / unionCount).toFixed(4));
  }

  private normalizeCode(code: string): string[] {
    return code
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, ' ')
      .split(' ')
      .filter((token) => token.length > 1);
  }


  private normalizeOutput(value: string | undefined) {
    return (value ?? '').trim().replace(/\r\n/g, '\n');
  }

  private async latestResultsForSubmission(submission: Submission) {
    const latestVersion = [...(submission.versions ?? [])].sort(
      (a, b) => b.version - a.version,
    )[0];
    if (!latestVersion) {
      return [];
    }

    const results = await this.submissionTestResultsRepository.find({
      where: { submitVersion: { id: latestVersion.id } },
      relations: { testCase: true },
      order: { created_at: 'ASC' },
    });

    return results
      .map((result) => ({
        id: result.id,
        passed: result.passed,
        actualOutput: result.actualOutput,
        errorMessage: result.errorMessage,
        executionTimeMs: result.executionTimeMs,
        testCase: result.testCase
          ? {
            id: result.testCase.id,
            input: result.testCase.input,
            expectedOutput: result.testCase.isSample
              ? result.testCase.expectedOutput
              : undefined,
            isSample: result.testCase.isSample,
            weight: result.testCase.weight,
            orderIndex: result.testCase.orderIndex,
          }
          : null,
      }));
  }
}

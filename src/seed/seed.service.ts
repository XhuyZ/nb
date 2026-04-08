import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Assignment,
  AssignmentStatus,
} from 'src/assignments/entities/assignment.entity';
import { AssignmentDocument } from 'src/assignments/entities/assignment-document.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import {
  ProcessingStatus,
  Submission,
  SubmissionLanguage,
  SubmissionStatus,
} from 'src/submissions/entities/submission.entity';
import { SubmissionTestResult } from 'src/submissions/entities/submission-test-result.entity';
import {
  SubmitVersion,
  SubmitVersionStatus,
} from 'src/submit-versions/entities/submit-version.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(AssignmentDocument)
    private readonly assignmentDocumentRepository: Repository<AssignmentDocument>,
    @InjectRepository(AssignmentTestCase)
    private readonly assignmentTestCaseRepository: Repository<AssignmentTestCase>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(SubmissionTestResult)
    private readonly submissionTestResultRepository: Repository<SubmissionTestResult>,
    @InjectRepository(SubmitVersion)
    private readonly submitVersionRepository: Repository<SubmitVersion>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismRepository: Repository<Plagiarism>,
  ) {}

  async onApplicationBootstrap() {
    await this.seed();
  }

  private async seed() {
    await this.dataSource.query(
      'TRUNCATE TABLE "plagiarisms", "submission_test_results", "submit_versions", "submissions", "assignment_test_cases", "assignment_documents", "assignments", "users" RESTART IDENTITY CASCADE',
    );

    const admin = this.userRepository.create({
      username: 'admin1',
      password: '123456',
      role: UserRole.ADMIN,
      status: true,
    });

    const teacher1 = this.userRepository.create({
      username: 'teacher1',
      password: '123456',
      role: UserRole.TEACHER,
      status: true,
    });

    const teacher2 = this.userRepository.create({
      username: 'teacher2',
      password: '123456',
      role: UserRole.TEACHER,
      status: true,
    });

    const students = Array.from({ length: 5 }, (_, index) =>
      this.userRepository.create({
        username: `student${index + 1}`,
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
    );

    await this.userRepository.save([admin, teacher1, teacher2, ...students]);

    const now = new Date();
    const closedDeadline = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const openDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const assignmentClosed = this.assignmentRepository.create({
      teacher: teacher1,
      title: 'Assignment 1 - Loops and Arrays',
      description: 'Bai tap da het han, 5 sinh vien da nop bai',
      deadline: closedDeadline,
      status: AssignmentStatus.CLOSED,
      maxScore: 100,
      evaluationCriteria:
        '- Dung ket qua\n- Toi uu bo nho\n- Trinh bay ro rang',
      allowLateSubmission: false,
      document: 'http://localhost:3000/uploads/assignment-1.pdf',
    });

    const assignmentOpen = this.assignmentRepository.create({
      teacher: teacher1,
      title: 'Assignment 2 - Recursion',
      description: 'Bai tap chua co submission',
      deadline: openDeadline,
      status: AssignmentStatus.OPEN,
      maxScore: 10,
      evaluationCriteria: '- Dung test case co ban\n- Viet de doc',
      allowLateSubmission: false,
    });

    const assignmentLateAllowed = this.assignmentRepository.create({
      teacher: teacher1,
      title: 'Assignment 3 - Dynamic Programming',
      description: 'Demo case nop tre han va nop nhieu lan',
      deadline: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      status: AssignmentStatus.OPEN,
      maxScore: 100,
      evaluationCriteria: '- Correctness 70%\n- Complexity 20%\n- Style 10%',
      allowLateSubmission: true,
    });

    await this.assignmentRepository.save([
      assignmentClosed,
      assignmentOpen,
      assignmentLateAllowed,
    ]);

    await this.assignmentTestCaseRepository.save([
      this.assignmentTestCaseRepository.create({
        assignment: assignmentClosed,
        input: '1 2',
        expectedOutput: '3',
        isSample: true,
        weight: 1,
        orderIndex: 1,
      }),
      this.assignmentTestCaseRepository.create({
        assignment: assignmentClosed,
        input: '10 20',
        expectedOutput: '30',
        isSample: false,
        weight: 2,
        orderIndex: 2,
      }),
      this.assignmentTestCaseRepository.create({
        assignment: assignmentLateAllowed,
        input: '5',
        expectedOutput: '5',
        isSample: true,
        weight: 1,
        orderIndex: 1,
      }),
      this.assignmentTestCaseRepository.create({
        assignment: assignmentLateAllowed,
        input: '10',
        expectedOutput: '55',
        isSample: false,
        weight: 3,
        orderIndex: 2,
      }),
    ]);

    await this.assignmentDocumentRepository.save([
      this.assignmentDocumentRepository.create({
        assignment: assignmentClosed,
        uploadedBy: teacher1,
        fileName: 'loops-guideline.pdf',
        mimeType: 'application/pdf',
        fileSize: 40213,
        fileUrl: 'http://localhost:3000/uploads/loops-guideline.pdf',
      }),
      this.assignmentDocumentRepository.create({
        assignment: assignmentLateAllowed,
        uploadedBy: teacher1,
        fileName: 'dp-examples.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 18920,
        fileUrl: 'http://localhost:3000/uploads/dp-examples.docx',
      }),
    ]);

    const submissions: Submission[] = students.map((student, index) =>
      this.submissionRepository.create({
        student,
        assignment: assignmentClosed,
        code: `function solve() { return ${index + 1}; }`,
        file: undefined,
        language: SubmissionLanguage.JAVASCRIPT,
        versionCount: 1,
        lastSubmittedAt: new Date(closedDeadline.getTime() - 2 * 60 * 60 * 1000),
        highestSimilarity: index < 2 ? 0.82 : 0.18,
        plagiarismFlag: index < 2,
        passRate: index < 2 ? 50 : 100,
        judgeStatus: ProcessingStatus.COMPLETED,
        plagiarismStatus: ProcessingStatus.COMPLETED,
        score: index < 2 ? 50 : 100,
        status: SubmissionStatus.SUBMITTED,
      }),
    );

    const savedSubmissions = await this.submissionRepository.save(submissions);

    const submitVersions = savedSubmissions.map((submission) =>
      this.submitVersionRepository.create({
        submission,
        version: 1,
        codeSnapshot: submission.code,
        fileUrl: submission.file,
        fileName: undefined,
        fileMimeType: undefined,
        fileSize: undefined,
        submittedAt:
          submission.lastSubmittedAt ??
          new Date(closedDeadline.getTime() - 2 * 60 * 60 * 1000),
        status: SubmitVersionStatus.ACTIVE,
      }),
    );

    const savedVersions = await this.submitVersionRepository.save(submitVersions);

    const student1LateSubmission = await this.submissionRepository.save(
      this.submissionRepository.create({
        student: students[0],
        assignment: assignmentLateAllowed,
        code: 'function solveDp(n){ if(n<=1) return n; return solveDp(n-1)+solveDp(n-2); }',
        file: 'http://localhost:3000/uploads/student1-dp-v2.zip',
        language: SubmissionLanguage.JAVASCRIPT,
        status: SubmissionStatus.SUBMITTED,
        versionCount: 2,
        lastSubmittedAt: new Date(now.getTime() + 5 * 60 * 1000),
        highestSimilarity: 0.91,
        plagiarismFlag: true,
        passRate: 50,
        judgeStatus: ProcessingStatus.COMPLETED,
        plagiarismStatus: ProcessingStatus.COMPLETED,
        score: 50,
      }),
    );

    const student2LateSubmission = await this.submissionRepository.save(
      this.submissionRepository.create({
        student: students[1],
        assignment: assignmentLateAllowed,
        code: 'function solveDp(n){if(n<=1){return n;}return solveDp(n-1)+solveDp(n-2);}',
        file: 'http://localhost:3000/uploads/student2-dp.zip',
        language: SubmissionLanguage.JAVASCRIPT,
        status: SubmissionStatus.SUBMITTED,
        versionCount: 1,
        lastSubmittedAt: new Date(now.getTime() - 30 * 60 * 1000),
        highestSimilarity: 0.91,
        plagiarismFlag: true,
        passRate: 50,
        judgeStatus: ProcessingStatus.COMPLETED,
        plagiarismStatus: ProcessingStatus.COMPLETED,
        score: 50,
      }),
    );

    const lateVersion1 = await this.submitVersionRepository.save(
      this.submitVersionRepository.create({
        submission: student1LateSubmission,
        version: 1,
        codeSnapshot:
          'function solveDp(n){ if(n<=1) return n; return solveDp(n-1)+solveDp(n-2); }',
        fileUrl: 'http://localhost:3000/uploads/student1-dp-v1.zip',
        fileName: 'student1-dp-v1.zip',
        fileMimeType: 'application/zip',
        fileSize: 2012,
        submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        status: SubmitVersionStatus.ARCHIVED,
      }),
    );

    const lateVersion2 = await this.submitVersionRepository.save(
      this.submitVersionRepository.create({
        submission: student1LateSubmission,
        version: 2,
        codeSnapshot:
          'function solveDp(n){ if(n<=1) return n; return solveDp(n-1)+solveDp(n-2); }',
        fileUrl: 'http://localhost:3000/uploads/student1-dp-v2.zip',
        fileName: 'student1-dp-v2.zip',
        fileMimeType: 'application/zip',
        fileSize: 2450,
        submittedAt: new Date(now.getTime() + 5 * 60 * 1000),
        status: SubmitVersionStatus.ACTIVE,
      }),
    );

    const lateVersion3 = await this.submitVersionRepository.save(
      this.submitVersionRepository.create({
        submission: student2LateSubmission,
        version: 1,
        codeSnapshot:
          'function solveDp(n){if(n<=1){return n;}return solveDp(n-1)+solveDp(n-2);}',
        fileUrl: 'http://localhost:3000/uploads/student2-dp.zip',
        fileName: 'student2-dp.zip',
        fileMimeType: 'application/zip',
        fileSize: 2199,
        submittedAt: new Date(now.getTime() - 30 * 60 * 1000),
        status: SubmitVersionStatus.ACTIVE,
      }),
    );

    await this.plagiarismRepository.save([
      this.plagiarismRepository.create({
        submitVersionA: savedVersions[0],
        submitVersionB: savedVersions[1],
        similarity: 0.82,
        highRisk: true,
      }),
      this.plagiarismRepository.create({
        submitVersionA: lateVersion2,
        submitVersionB: lateVersion3,
        similarity: 0.91,
        highRisk: true,
      }),
      this.plagiarismRepository.create({
        submitVersionA: lateVersion1,
        submitVersionB: lateVersion3,
        similarity: 0.65,
        highRisk: false,
      }),
    ]);

    const closedCases = await this.assignmentTestCaseRepository.find({
      where: { assignment: { id: assignmentClosed.id } },
      order: { orderIndex: 'ASC' },
    });
    const lateCases = await this.assignmentTestCaseRepository.find({
      where: { assignment: { id: assignmentLateAllowed.id } },
      order: { orderIndex: 'ASC' },
    });

    if (savedSubmissions[0] && savedVersions[0] && closedCases.length > 0) {
      await this.submissionTestResultRepository.save([
        this.submissionTestResultRepository.create({
          submission: savedSubmissions[0],
          submitVersion: savedVersions[0],
          testCase: closedCases[0],
          passed: true,
          actualOutput: '3',
          executionTimeMs: 12,
        }),
        this.submissionTestResultRepository.create({
          submission: savedSubmissions[0],
          submitVersion: savedVersions[0],
          testCase: closedCases[1],
          passed: false,
          actualOutput: '29',
          errorMessage: 'Wrong answer',
          executionTimeMs: 9,
        }),
      ]);
    }

    if (student1LateSubmission && lateVersion2 && lateCases.length > 0) {
      await this.submissionTestResultRepository.save([
        this.submissionTestResultRepository.create({
          submission: student1LateSubmission,
          submitVersion: lateVersion2,
          testCase: lateCases[0],
          passed: true,
          actualOutput: '5',
          executionTimeMs: 6,
        }),
        this.submissionTestResultRepository.create({
          submission: student1LateSubmission,
          submitVersion: lateVersion2,
          testCase: lateCases[1],
          passed: false,
          actualOutput: '34',
          errorMessage: 'Wrong answer',
          executionTimeMs: 10,
        }),
      ]);
    }

    this.logger.log('Seed data synced successfully');
  }
}

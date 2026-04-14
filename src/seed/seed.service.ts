import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Assignment,
  AssignmentStatus,
} from 'src/assignments/entities/assignment.entity';
import { AssignmentDocument } from 'src/assignments/entities/assignment-document.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { Chapter } from 'src/courses/entities/chapter.entity';
import { CourseMember } from 'src/courses/entities/course-member.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import {
  PlagiarismReview,
  ReviewVerdict,
} from 'src/review-verdict/entities/plagiarism-review.entity';
import {
  AcademicReport,
  ReportType,
} from 'src/statistics-reporting/entities/academic-report.entity';
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

const DEMO_IDS = {
  users: {
    admin1: '00000000-0000-4000-8000-000000000001',
    teacher1: '00000000-0000-4000-8000-000000000002',
    teacher2: '00000000-0000-4000-8000-000000000003',
    student1: '00000000-0000-4000-8000-000000000011',
    student2: '00000000-0000-4000-8000-000000000012',
    student3: '00000000-0000-4000-8000-000000000013',
    student4: '00000000-0000-4000-8000-000000000014',
    student5: '00000000-0000-4000-8000-000000000015',
  },
  courses: {
    course1: '10000000-0000-4000-8000-000000000001',
    course2: '10000000-0000-4000-8000-000000000002',
  },
  chapters: {
    chapter1: '11000000-0000-4000-8000-000000000001',
    chapter2: '11000000-0000-4000-8000-000000000002',
    chapter3: '11000000-0000-4000-8000-000000000003',
    chapter4: '11000000-0000-4000-8000-000000000004',
  },
  assignments: {
    assignment1: '12000000-0000-4000-8000-000000000001',
    assignment2: '12000000-0000-4000-8000-000000000002',
    assignment3: '12000000-0000-4000-8000-000000000003',
    assignment4: '12000000-0000-4000-8000-000000000004',
  },
  submissions: {
    student1A1: '13000000-0000-4000-8000-000000000001',
    student2A1: '13000000-0000-4000-8000-000000000002',
    student1A3: '13000000-0000-4000-8000-000000000003',
    student2A3: '13000000-0000-4000-8000-000000000004',
  },
  versions: {
    student1A1v1: '14000000-0000-4000-8000-000000000001',
    student2A1v1: '14000000-0000-4000-8000-000000000002',
    student1A3v1: '14000000-0000-4000-8000-000000000003',
    student1A3v2: '14000000-0000-4000-8000-000000000004',
    student2A3v1: '14000000-0000-4000-8000-000000000005',
  },
  plagiarisms: {
    a1High: '15000000-0000-4000-8000-000000000001',
    a3High: '15000000-0000-4000-8000-000000000002',
    a3Medium: '15000000-0000-4000-8000-000000000003',
  },
  reviews: {
    confirmedCopy: '16000000-0000-4000-8000-000000000001',
    needMoreReview: '16000000-0000-4000-8000-000000000002',
  },
};

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    @InjectRepository(CourseMember)
    private readonly courseMemberRepository: Repository<CourseMember>,
    @InjectRepository(AcademicReport)
    private readonly reportRepository: Repository<AcademicReport>,
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
    @InjectRepository(PlagiarismReview)
    private readonly plagiarismReviewRepository: Repository<PlagiarismReview>,
  ) {}

  async onApplicationBootstrap() {
    await this.seed();
  }

  private async seed() {
    await this.dataSource.query(
      'TRUNCATE TABLE "plagiarisms", "plagiarism_reviews", "academic_reports", "submission_test_results", "submit_versions", "submissions", "assignment_test_cases", "assignment_documents", "chapters", "course_members", "courses", "assignments", "users" RESTART IDENTITY CASCADE',
    );

    const admin = this.userRepository.create({
      id: DEMO_IDS.users.admin1,
      username: 'admin1',
      password: '123456',
      role: UserRole.ADMIN,
      status: true,
    });

    const teacher1 = this.userRepository.create({
      id: DEMO_IDS.users.teacher1,
      username: 'teacher1',
      password: '123456',
      role: UserRole.TEACHER,
      status: true,
    });

    const teacher2 = this.userRepository.create({
      id: DEMO_IDS.users.teacher2,
      username: 'teacher2',
      password: '123456',
      role: UserRole.TEACHER,
      status: true,
    });

    const students = [
      this.userRepository.create({
        id: DEMO_IDS.users.student1,
        username: 'student1',
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
      this.userRepository.create({
        id: DEMO_IDS.users.student2,
        username: 'student2',
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
      this.userRepository.create({
        id: DEMO_IDS.users.student3,
        username: 'student3',
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
      this.userRepository.create({
        id: DEMO_IDS.users.student4,
        username: 'student4',
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
      this.userRepository.create({
        id: DEMO_IDS.users.student5,
        username: 'student5',
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
    ];

    await this.userRepository.save([admin, teacher1, teacher2, ...students]);

    const now = new Date();
    const closedDeadline = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const openDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const course = await this.courseRepository.save(
      this.courseRepository.create({
        id: DEMO_IDS.courses.course1,
        teacher: teacher1,
        name: 'Course 1 - Algorithm Foundations',
        description: 'Khoa hoc gom 3 chuong, moi chuong 1 assignment',
        isPublished: true,
      }),
    );

    const chapter1 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter1,
        course,
        title: 'Chuong 1 - Loops and Arrays',
        orderIndex: 1,
      }),
    );
    const chapter2 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter2,
        course,
        title: 'Chuong 2 - Recursion',
        orderIndex: 2,
      }),
    );
    const chapter3 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter3,
        course,
        title: 'Chuong 3 - Dynamic Programming',
        orderIndex: 3,
      }),
    );

    await this.courseMemberRepository.save(
      students.slice(0, 4).map((student) =>
        this.courseMemberRepository.create({
          course,
          student,
          active: true,
        }),
      ),
    );

    const course2 = await this.courseRepository.save(
      this.courseRepository.create({
        id: DEMO_IDS.courses.course2,
        teacher: teacher2,
        name: 'Course 2 - Data Structures',
        description: 'Khoa hoc cua teacher2 de demo bo loc theo giao vien',
        isPublished: true,
      }),
    );
    const course2Chapter = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter4,
        course: course2,
        title: 'Chuong 1 - Stack Queue',
        orderIndex: 1,
      }),
    );

    const assignmentClosed = this.assignmentRepository.create({
      id: DEMO_IDS.assignments.assignment1,
      teacher: teacher1,
      chapter: chapter1,
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
      id: DEMO_IDS.assignments.assignment2,
      teacher: teacher1,
      chapter: chapter2,
      title: 'Assignment 2 - Recursion',
      description: 'Bai tap chua co submission',
      deadline: openDeadline,
      status: AssignmentStatus.OPEN,
      maxScore: 10,
      evaluationCriteria: '- Dung test case co ban\n- Viet de doc',
      allowLateSubmission: false,
    });

    const assignmentLateAllowed = this.assignmentRepository.create({
      id: DEMO_IDS.assignments.assignment3,
      teacher: teacher1,
      chapter: chapter3,
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

    chapter1.assignment = assignmentClosed;
    chapter2.assignment = assignmentOpen;
    chapter3.assignment = assignmentLateAllowed;
    await this.chapterRepository.save([chapter1, chapter2, chapter3]);

    const teacher2Assignment = await this.assignmentRepository.save(
      this.assignmentRepository.create({
        id: DEMO_IDS.assignments.assignment4,
        teacher: teacher2,
        chapter: course2Chapter,
        title: 'Assignment 4 - Stack Basics',
        description: 'Assignment thuoc course teacher2, chua co nop bai',
        deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: AssignmentStatus.OPEN,
        maxScore: 100,
        evaluationCriteria: '- Correctness\n- Time complexity',
        allowLateSubmission: false,
      }),
    );
    course2Chapter.assignment = teacher2Assignment;
    await this.chapterRepository.save(course2Chapter);

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
        id:
          index === 0
            ? DEMO_IDS.submissions.student1A1
            : index === 1
              ? DEMO_IDS.submissions.student2A1
              : undefined,
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
        id:
          submission.id === DEMO_IDS.submissions.student1A1
            ? DEMO_IDS.versions.student1A1v1
            : submission.id === DEMO_IDS.submissions.student2A1
              ? DEMO_IDS.versions.student2A1v1
              : undefined,
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
        id: DEMO_IDS.submissions.student1A3,
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
        id: DEMO_IDS.submissions.student2A3,
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
        id: DEMO_IDS.versions.student1A3v1,
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
        id: DEMO_IDS.versions.student1A3v2,
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
        id: DEMO_IDS.versions.student2A3v1,
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
        id: DEMO_IDS.plagiarisms.a1High,
        submitVersionA: savedVersions[0],
        submitVersionB: savedVersions[1],
        similarity: 0.82,
        highRisk: true,
        evidence: {
          commonTokens: ['function', 'solve', 'return'],
          commonLines: ['function solve() { return 1; }'],
        },
      }),
      this.plagiarismRepository.create({
        id: DEMO_IDS.plagiarisms.a3High,
        submitVersionA: lateVersion2,
        submitVersionB: lateVersion3,
        similarity: 0.91,
        highRisk: true,
        evidence: {
          commonTokens: ['solveDp', 'return', 'n', 'if'],
          commonLines: ['return solveDp(n-1)+solveDp(n-2);'],
        },
      }),
      this.plagiarismRepository.create({
        id: DEMO_IDS.plagiarisms.a3Medium,
        submitVersionA: lateVersion1,
        submitVersionB: lateVersion3,
        similarity: 0.65,
        highRisk: false,
        evidence: {
          commonTokens: ['solveDp', 'return'],
          commonLines: [],
        },
      }),
    ]);

    await this.plagiarismReviewRepository.save([
      this.plagiarismReviewRepository.create({
        id: DEMO_IDS.reviews.confirmedCopy,
        submission: student1LateSubmission,
        reviewer: teacher1,
        verdict: ReviewVerdict.CONFIRMED_COPY,
        note: 'Trung lap cao o cac ham de quy, can xu ly vi pham',
        reviewedAt: new Date(now.getTime() - 10 * 60 * 1000),
      }),
      this.plagiarismReviewRepository.create({
        id: DEMO_IDS.reviews.needMoreReview,
        submission: savedSubmissions[0],
        reviewer: teacher1,
        verdict: ReviewVerdict.NEED_MORE_REVIEW,
        note: 'Can phan tich them lich su nop va bang chung AST',
        reviewedAt: new Date(now.getTime() - 5 * 60 * 1000),
      }),
    ]);

    await this.reportRepository.save(
      this.reportRepository.create({
        generatedBy: teacher1,
        type: ReportType.ACADEMIC_INTEGRITY,
        courseId: course.id,
        fileName: 'seed-demo-report.pdf',
        fileUrl: 'http://localhost:3000/uploads/reports/seed-demo-report.pdf',
        metadata: {
          seeded: true,
          note: 'Bao cao mau cho demo stakeholder',
        },
      }),
    );

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

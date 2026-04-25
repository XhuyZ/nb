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

const STUDENT_COUNT = 30;

const DEMO_IDS = {
  users: {
    admin1: '00000000-0000-4000-8000-000000000001',
    teacher1: '00000000-0000-4000-8000-000000000002',
    teacher2: '00000000-0000-4000-8000-000000000003',
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
};

const buildDemoUuid = (prefix: string, index: number) =>
  `${prefix}-0000-4000-8000-${index.toString().padStart(12, '0')}`;

const studentId = (studentNumber: number) =>
  buildDemoUuid('00000000', 100 + studentNumber);

const submissionId = (group: number, index: number) =>
  buildDemoUuid('13000000', group * 100 + index);

const versionId = (group: number, index: number) =>
  buildDemoUuid('14000000', group * 100 + index);

const plagiarismId = (index: number) => buildDemoUuid('15000000', index);
const reviewId = (index: number) => buildDemoUuid('16000000', index);

const atUtcOffset = (base: Date, dayOffset: number, hour: number, minute = 0) => {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
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
  ) { }

  async onApplicationBootstrap() {
    await this.seed();
  }

  private async seed() {
    await this.dataSource.query(
      'TRUNCATE TABLE "password_reset_tokens", "plagiarisms", "plagiarism_reviews", "academic_reports", "submission_test_results", "submit_versions", "submissions", "assignment_test_cases", "assignment_documents", "chapters", "course_members", "courses", "assignments", "users" RESTART IDENTITY CASCADE',
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

    const students = Array.from({ length: STUDENT_COUNT }, (_, index) =>
      this.userRepository.create({
        id: studentId(index + 1),
        username: `student${index + 1}`,
        password: '123456',
        role: UserRole.STUDENT,
        status: true,
      }),
    );

    await this.userRepository.save([admin, teacher1, teacher2, ...students]);

    const now = new Date();
    const closedDeadline = atUtcOffset(now, -5, 23, 59);
    const openDeadline = atUtcOffset(now, 7, 23, 59);
    const lateAllowedDeadline = atUtcOffset(now, -2, 23, 59);

    const course1 = await this.courseRepository.save(
      this.courseRepository.create({
        id: DEMO_IDS.courses.course1,
        teacher: teacher1,
        name: 'Course 1 - Algorithm Foundations',
        description:
          'Demo course for teacher1 with 30 enrolled students, realistic submission history, and review verdict cases.',
        isPublished: true,
      }),
    );

    const chapter1 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter1,
        course: course1,
        title: 'Chapter 1 - Loops and Arrays',
        orderIndex: 1,
      }),
    );
    const chapter2 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter2,
        course: course1,
        title: 'Chapter 2 - Recursion',
        orderIndex: 2,
      }),
    );
    const chapter3 = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter3,
        course: course1,
        title: 'Chapter 3 - Dynamic Programming',
        orderIndex: 3,
      }),
    );

    await this.courseMemberRepository.save(
      students.map((student) =>
        this.courseMemberRepository.create({
          course: course1,
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
        description: 'Secondary course for teacher2 to keep teacher filter demos available.',
        isPublished: true,
      }),
    );
    const course2Chapter = await this.chapterRepository.save(
      this.chapterRepository.create({
        id: DEMO_IDS.chapters.chapter4,
        course: course2,
        title: 'Chapter 1 - Stack and Queue',
        orderIndex: 1,
      }),
    );

    const assignmentClosed = this.assignmentRepository.create({
      id: DEMO_IDS.assignments.assignment1,
      teacher: teacher1,
      chapter: chapter1,
      title: 'Assignment 1 - Array Sum Analyzer',
      description:
        'A closed assignment with all 30 students submitting across multiple dates for dashboard trend demos.',
      deadline: closedDeadline,
      status: AssignmentStatus.CLOSED,
      maxScore: 100,
      evaluationCriteria:
        '- Correct output\n- Clean iteration logic\n- Good code readability',
      allowLateSubmission: false,
      document: 'http://localhost:3000/uploads/assignment-1.pdf',
    });

    const assignmentOpen = this.assignmentRepository.create({
      id: DEMO_IDS.assignments.assignment2,
      teacher: teacher1,
      chapter: chapter2,
      title: 'Assignment 2 - Recursive Thinking',
      description: 'An open assignment reserved for create and list assignment demos.',
      deadline: openDeadline,
      status: AssignmentStatus.OPEN,
      maxScore: 100,
      evaluationCriteria:
        '- Correct recursion base case\n- Good readability\n- Matches sample tests',
      allowLateSubmission: false,
      document: 'http://localhost:3000/uploads/assignment-2.pdf',
    });

    const assignmentLateAllowed = this.assignmentRepository.create({
      id: DEMO_IDS.assignments.assignment3,
      teacher: teacher1,
      chapter: chapter3,
      title: 'Assignment 3 - Fibonacci Optimizer',
      description:
        'A late-allowed assignment with resubmissions to make submission trends look realistic.',
      deadline: lateAllowedDeadline,
      status: AssignmentStatus.OPEN,
      maxScore: 100,
      evaluationCriteria:
        '- Correctness 70%\n- Complexity 20%\n- Code style 10%',
      allowLateSubmission: true,
      document: 'http://localhost:3000/uploads/assignment-3.pdf',
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
        description: 'Teacher2 assignment kept for course filtering and ownership demos.',
        deadline: atUtcOffset(now, 5, 23, 59),
        status: AssignmentStatus.OPEN,
        maxScore: 100,
        evaluationCriteria: '- Correctness\n- Time complexity',
        allowLateSubmission: false,
        document: 'http://localhost:3000/uploads/assignment-4.pdf',
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
        assignment: assignmentOpen,
        uploadedBy: teacher1,
        fileName: 'recursion-reference.pdf',
        mimeType: 'application/pdf',
        fileSize: 28410,
        fileUrl: 'http://localhost:3000/uploads/recursion-reference.pdf',
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

    const assignment1DayOffsets = [
      28, 27, 27, 26, 25, 24, 24, 23, 22, 22,
      21, 20, 19, 19, 18, 17, 16, 15, 15, 14,
      13, 12, 11, 10, 10, 9, 8, 7, 6, 6,
    ];
    const assignment3InitialOffsets = [8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3];
    const assignment3ResubmissionOffsets = [4, 3, 3, 2, 2, 1, 1, 0];

    const assignment1Submissions = students.map((student, index) => {
      const studentNumber = index + 1;
      const isFlagged = index < 3;
      const submittedAt = atUtcOffset(
        now,
        -assignment1DayOffsets[index],
        9 + (index % 5),
        (index * 7) % 60,
      );

      const suspiciousCodes = [
        'function solve(nums) { let total = 0; for (const value of nums) { total += value; } return total; }',
        'function solve(nums) { let total = 0; for (const value of nums) { total += value; } return total; }',
        'function solve(nums) { let total = 0; for (const value of nums) { total = total + value; } return total; }',
      ];

      return this.submissionRepository.create({
        id: submissionId(1, studentNumber),
        student,
        assignment: assignmentClosed,
        code:
          suspiciousCodes[index] ??
          `function solve(nums) { return nums.reduce((sum, value) => sum + value, 0); } // student${studentNumber}`,
        file: undefined,
        language: SubmissionLanguage.JAVASCRIPT,
        versionCount: 1,
        lastSubmittedAt: submittedAt,
        highestSimilarity: isFlagged ? [0.94, 0.92, 0.89][index] : 0.14 + (index % 5) * 0.03,
        plagiarismFlag: isFlagged,
        passRate: isFlagged ? [62, 58, 60][index] : 72 + (index % 5) * 7,
        judgeStatus: ProcessingStatus.COMPLETED,
        plagiarismStatus: ProcessingStatus.COMPLETED,
        score: isFlagged ? [62, 58, 60][index] : 72 + (index % 5) * 7,
        status: SubmissionStatus.SUBMITTED,
      });
    });
    await this.submissionRepository.save(assignment1Submissions);

    const assignment1Versions = assignment1Submissions.map((submission, index) =>
      this.submitVersionRepository.create({
        id: versionId(1, index + 1),
        submission,
        version: 1,
        codeSnapshot: submission.code,
        fileUrl: submission.file,
        fileName: undefined,
        fileMimeType: undefined,
        fileSize: undefined,
        submittedAt: submission.lastSubmittedAt ?? closedDeadline,
        status: SubmitVersionStatus.ACTIVE,
      }),
    );
    await this.submitVersionRepository.save(assignment1Versions);

    const assignment3Students = students.slice(0, assignment3InitialOffsets.length);
    const assignment3Submissions = assignment3Students.map((student, index) => {
      const studentNumber = index + 1;
      const hasResubmission = index < assignment3ResubmissionOffsets.length;
      const activeSubmittedAt = hasResubmission
        ? atUtcOffset(now, -assignment3ResubmissionOffsets[index], 18 - (index % 4), 10)
        : atUtcOffset(now, -assignment3InitialOffsets[index], 11 + (index % 3), 25);
      const isFlagged = index === 3 || index === 4;
      const activeCodes = [
        'function solveDp(n) { if (n <= 1) return n; return solveDp(n - 1) + solveDp(n - 2); }',
        'function solveDp(n) { const memo = [0, 1]; for (let i = 2; i <= n; i += 1) memo[i] = memo[i - 1] + memo[i - 2]; return memo[n] ?? 0; }',
        'function solveDp(n) { let prev = 0; let curr = 1; for (let i = 0; i < n; i += 1) { [prev, curr] = [curr, prev + curr]; } return prev; }',
        'function solveDp(n){if(n<=1){return n;}return solveDp(n-1)+solveDp(n-2);}',
        'function solveDp(n){if(n<=1){return n;}return solveDp(n-1)+solveDp(n-2);}',
      ];

      const normalScore = 68 + (index % 4) * 8;

      return this.submissionRepository.create({
        id: submissionId(2, studentNumber),
        student,
        assignment: assignmentLateAllowed,
        code:
          activeCodes[index] ??
          `function solveDp(n) { const dp = [0, 1]; for (let i = 2; i <= n; i += 1) dp[i] = dp[i - 1] + dp[i - 2]; return dp[n] ?? n; } // student${studentNumber}`,
        file: `http://localhost:3000/uploads/student${studentNumber}-assignment3.zip`,
        language: SubmissionLanguage.JAVASCRIPT,
        status: SubmissionStatus.SUBMITTED,
        versionCount: hasResubmission ? 2 : 1,
        lastSubmittedAt: activeSubmittedAt,
        highestSimilarity: isFlagged ? (index === 3 ? 0.93 : 0.91) : 0.18 + (index % 4) * 0.04,
        plagiarismFlag: isFlagged,
        passRate: isFlagged ? 55 : normalScore,
        judgeStatus: ProcessingStatus.COMPLETED,
        plagiarismStatus: ProcessingStatus.COMPLETED,
        score: isFlagged ? 55 : normalScore,
      });
    });
    await this.submissionRepository.save(assignment3Submissions);

    const assignment3InitialVersions: SubmitVersion[] = [];
    const assignment3ActiveVersions: SubmitVersion[] = [];
    const assignment3AllVersions: SubmitVersion[] = [];

    assignment3Submissions.forEach((submission, index) => {
      const studentNumber = index + 1;
      const hasResubmission = index < assignment3ResubmissionOffsets.length;
      const initialVersion = this.submitVersionRepository.create({
        id: versionId(2, studentNumber),
        submission,
        version: 1,
        codeSnapshot:
          index === 3 || index === 4
            ? 'function solveDp(n){ if(n<=1) return n; return solveDp(n-1)+solveDp(n-2); }'
            : `function solveDp(n) { if (n <= 1) return n; return solveDp(n - 1) + solveDp(n - 2); } // v1 student${studentNumber}`,
        fileUrl: `http://localhost:3000/uploads/student${studentNumber}-assignment3-v1.zip`,
        fileName: `student${studentNumber}-assignment3-v1.zip`,
        fileMimeType: 'application/zip',
        fileSize: 2100 + index * 31,
        submittedAt: atUtcOffset(
          now,
          -assignment3InitialOffsets[index],
          10 + (index % 4),
          5,
        ),
        status: hasResubmission ? SubmitVersionStatus.ARCHIVED : SubmitVersionStatus.ACTIVE,
      });

      assignment3InitialVersions.push(initialVersion);
      assignment3AllVersions.push(initialVersion);

      if (hasResubmission) {
        const activeVersion = this.submitVersionRepository.create({
          id: versionId(3, studentNumber),
          submission,
          version: 2,
          codeSnapshot: submission.code,
          fileUrl: submission.file,
          fileName: `student${studentNumber}-assignment3-v2.zip`,
          fileMimeType: 'application/zip',
          fileSize: 2400 + index * 37,
          submittedAt: submission.lastSubmittedAt ?? lateAllowedDeadline,
          status: SubmitVersionStatus.ACTIVE,
        });
        assignment3ActiveVersions.push(activeVersion);
        assignment3AllVersions.push(activeVersion);
        return;
      }

      assignment3ActiveVersions.push(initialVersion);
    });
    await this.submitVersionRepository.save(assignment3AllVersions);

    await this.plagiarismRepository.save([
      this.plagiarismRepository.create({
        id: plagiarismId(1),
        submitVersionA: assignment1Versions[0],
        submitVersionB: assignment1Versions[1],
        similarity: 0.94,
        highRisk: true,
        evidence: {
          commonTokens: ['function', 'solve', 'total', 'return'],
          commonLines: ['for (const value of nums) { total += value; }'],
          astNodesA: ['FunctionDeclaration', 'ForOfStatement', 'ReturnStatement'],
          astNodesB: ['FunctionDeclaration', 'ForOfStatement', 'ReturnStatement'],
        },
      }),
      this.plagiarismRepository.create({
        id: plagiarismId(2),
        submitVersionA: assignment1Versions[0],
        submitVersionB: assignment1Versions[2],
        similarity: 0.89,
        highRisk: true,
        evidence: {
          commonTokens: ['function', 'solve', 'total', 'value'],
          commonLines: ['let total = 0;', 'return total;'],
          astNodesA: ['VariableDeclaration', 'ForOfStatement'],
          astNodesB: ['VariableDeclaration', 'ForOfStatement'],
        },
      }),
      this.plagiarismRepository.create({
        id: plagiarismId(3),
        submitVersionA: assignment1Versions[1],
        submitVersionB: assignment1Versions[2],
        similarity: 0.86,
        highRisk: true,
        evidence: {
          commonTokens: ['solve', 'total', 'return'],
          commonLines: ['function solve(nums) { let total = 0;'],
          astNodesA: ['FunctionDeclaration', 'Identifier'],
          astNodesB: ['FunctionDeclaration', 'Identifier'],
        },
      }),
      this.plagiarismRepository.create({
        id: plagiarismId(4),
        submitVersionA: assignment3ActiveVersions[3],
        submitVersionB: assignment3ActiveVersions[4],
        similarity: 0.93,
        highRisk: true,
        evidence: {
          commonTokens: ['solveDp', 'if', 'return', 'n'],
          commonLines: ['return solveDp(n-1)+solveDp(n-2);'],
          astNodesA: ['IfStatement', 'BinaryExpression', 'CallExpression'],
          astNodesB: ['IfStatement', 'BinaryExpression', 'CallExpression'],
        },
      }),
      this.plagiarismRepository.create({
        id: plagiarismId(5),
        submitVersionA: assignment3InitialVersions[3],
        submitVersionB: assignment3ActiveVersions[4],
        similarity: 0.68,
        highRisk: false,
        evidence: {
          commonTokens: ['solveDp', 'return'],
          commonLines: ['if(n<=1){return n;}'],
          astNodesA: ['IfStatement', 'ReturnStatement'],
          astNodesB: ['IfStatement', 'ReturnStatement'],
        },
      }),
    ]);

    await this.plagiarismReviewRepository.save([
      this.plagiarismReviewRepository.create({
        id: reviewId(1),
        submission: assignment1Submissions[0],
        reviewer: teacher1,
        verdict: ReviewVerdict.NEED_MORE_REVIEW,
        note: 'Requires manual review because the token match and AST structure are unusually close.',
        reviewedAt: atUtcOffset(now, -1, 10, 15),
      }),
      this.plagiarismReviewRepository.create({
        id: reviewId(2),
        submission: assignment1Submissions[1],
        reviewer: teacher1,
        verdict: ReviewVerdict.CONFIRMED_COPY,
        note: 'Confirmed copy after comparing nearly identical loop structure and variable naming.',
        reviewedAt: atUtcOffset(now, -1, 11, 30),
      }),
      this.plagiarismReviewRepository.create({
        id: reviewId(3),
        submission: assignment3Submissions[3],
        reviewer: teacher1,
        verdict: ReviewVerdict.CONFIRMED_COPY,
        note: 'Recursive implementation matches another student version with very high similarity.',
        reviewedAt: atUtcOffset(now, 0, 9, 45),
      }),
      this.plagiarismReviewRepository.create({
        id: reviewId(4),
        submission: assignment3Submissions[4],
        reviewer: teacher1,
        verdict: ReviewVerdict.VALID,
        note: 'Reviewed and kept as valid because the student provided a credible explanation during follow-up.',
        reviewedAt: atUtcOffset(now, 0, 13, 5),
      }),
    ]);

    await this.reportRepository.save(
      this.reportRepository.create({
        generatedBy: teacher1,
        type: ReportType.ACADEMIC_INTEGRITY,
        courseId: course1.id,
        fileName: 'seed-demo-report.pdf',
        fileUrl: 'http://localhost:3000/uploads/reports/seed-demo-report.pdf',
        metadata: {
          seeded: true,
          studentCount: STUDENT_COUNT,
          highRiskReviewCases: 5,
          note: 'Seeded dashboard and review data for stakeholder demo.',
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

    if (closedCases.length > 1) {
      await this.submissionTestResultRepository.save([
        this.submissionTestResultRepository.create({
          submission: assignment1Submissions[0],
          submitVersion: assignment1Versions[0],
          testCase: closedCases[0],
          passed: true,
          actualOutput: '3',
          executionTimeMs: 12,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment1Submissions[0],
          submitVersion: assignment1Versions[0],
          testCase: closedCases[1],
          passed: false,
          actualOutput: '29',
          errorMessage: 'Wrong answer',
          executionTimeMs: 9,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment1Submissions[9],
          submitVersion: assignment1Versions[9],
          testCase: closedCases[0],
          passed: true,
          actualOutput: '3',
          executionTimeMs: 8,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment1Submissions[9],
          submitVersion: assignment1Versions[9],
          testCase: closedCases[1],
          passed: true,
          actualOutput: '30',
          executionTimeMs: 7,
        }),
      ]);
    }

    if (lateCases.length > 1) {
      await this.submissionTestResultRepository.save([
        this.submissionTestResultRepository.create({
          submission: assignment3Submissions[3],
          submitVersion: assignment3ActiveVersions[3],
          testCase: lateCases[0],
          passed: true,
          actualOutput: '5',
          executionTimeMs: 6,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment3Submissions[3],
          submitVersion: assignment3ActiveVersions[3],
          testCase: lateCases[1],
          passed: false,
          actualOutput: '34',
          errorMessage: 'Wrong answer',
          executionTimeMs: 11,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment3Submissions[10],
          submitVersion: assignment3ActiveVersions[10],
          testCase: lateCases[0],
          passed: true,
          actualOutput: '5',
          executionTimeMs: 5,
        }),
        this.submissionTestResultRepository.create({
          submission: assignment3Submissions[10],
          submitVersion: assignment3ActiveVersions[10],
          testCase: lateCases[1],
          passed: true,
          actualOutput: '55',
          executionTimeMs: 7,
        }),
      ]);
    }

    this.logger.log('Seed data synced successfully');
  }
}

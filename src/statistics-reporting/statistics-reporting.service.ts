import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import {
  PlagiarismReview,
  ReviewVerdict,
} from 'src/review-verdict/entities/plagiarism-review.entity';
import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { AcademicReport, ReportType } from './entities/academic-report.entity';

type TrendPoint = {
  date: string;
  submissionCount: number;
};

type AssignmentReportRow = {
  assignmentTitle: string;
  chapterTitle: string;
  status: string;
  submissionCount: number;
  uniqueStudents: number;
  averageScore: number;
  flaggedCount: number;
  deadline: string;
};

type ReviewQueueRow = {
  student: string;
  assignment: string;
  similarity: number;
  verdict: string;
  reviewedAt: string;
};

type PdfMetricCard = {
  label: string;
  value: string;
  hint: string;
};

type PdfPayload = {
  reportTitle: string;
  reportTypeLabel: string;
  scopeLabel: string;
  generatedBy: string;
  generatedAt: string;
  courseName: string;
  instructorName: string;
  extractionDate: string;
  overview: Awaited<ReturnType<StatisticsReportingService['getOverview']>>;
  performance: {
    totalStudents: number;
    totalValidSubmissions: number;
    averageScore: number;
    rates: { excellent: number; pass: number; fail: number };
  };
  integrity: {
    flaggedCount: number;
    avgSimilarity: number;
    confirmedCases: number;
    warningCases: number;
    dismissedCases: number;
    hotspotAssignment?: string;
    hotspotCount?: number;
  };
  assignments: AssignmentReportRow[];
  violationList: Array<{
    studentId: string;
    fullName: string;
    similarity: number;
    source: string;
    penalty: string;
  }>;
};

@Injectable()
export class StatisticsReportingService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(SubmitVersion)
    private readonly submitVersionsRepository: Repository<SubmitVersion>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismsRepository: Repository<Plagiarism>,
    @InjectRepository(PlagiarismReview)
    private readonly reviewsRepository: Repository<PlagiarismReview>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepository: Repository<Assignment>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(AcademicReport)
    private readonly reportsRepository: Repository<AcademicReport>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  async getOverview(courseId?: string) {
    const submissions = await this.getSubmissions(courseId);
    const plagiarisms = await this.getPlagiarisms(courseId);
    const assignments = await this.getAssignments(courseId);

    const suspicious = submissions.filter((item) => item.plagiarismFlag).length;
    const suspiciousRate =
      submissions.length === 0 ? 0 : Number(((suspicious / submissions.length) * 100).toFixed(2));

    const completionRate =
      assignments.length === 0
        ? 0
        : Number(((submissions.length / assignments.length) * 100).toFixed(2));

    return {
      totalCourses: courseId ? 1 : await this.coursesRepository.count(),
      totalAssignments: assignments.length,
      totalSubmissions: submissions.length,
      suspiciousRate,
      plagiarismDistribution: this.buildSimilarityDistribution(plagiarisms),
      submissionCompletion: {
        submitted: submissions.length,
        expectedAssignments: assignments.length,
        completionRate,
      },
    };
  }

  async getVisualizationData(courseId?: string) {
    const submissions = await this.getSubmissions(courseId);
    const plagiarisms = await this.getPlagiarisms(courseId);

    const byCourseMap = new Map<string, { courseName: string; count: number }>();
    submissions.forEach((submission) => {
      const courseIdKey = submission.assignment?.chapter?.course?.id;
      const courseName = submission.assignment?.chapter?.course?.name ?? 'Unknown course';
      if (!courseIdKey) {
        return;
      }
      const current = byCourseMap.get(courseIdKey) ?? { courseName, count: 0 };
      current.count += 1;
      byCourseMap.set(courseIdKey, current);
    });

    const trendByDayMap = new Map<string, number>();
    submissions.forEach((submission) => {
      const key = submission.created_at.toISOString().slice(0, 10);
      trendByDayMap.set(key, (trendByDayMap.get(key) ?? 0) + 1);
    });

    return {
      barChart: [...byCourseMap.entries()].map(([id, value]) => ({
        courseId: id,
        courseName: value.courseName,
        submissionCount: value.count,
      })),
      pieChart: this.buildSimilarityDistribution(plagiarisms),
      trendChart: [...trendByDayMap.entries()].map(([date, count]) => ({
        date,
        submissionCount: count,
      })),
    };
  }

  async getSubmissionTrends(courseId: string, days = 30) {
    if (!courseId) {
      throw new BadRequestException('Course id is required');
    }

    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const trend = await this.buildSubmissionTrendData(days, courseId);
    return {
      course: {
        id: course.id,
        name: course.name,
      },
      range: trend.range,
      summary: trend.summary,
      points: trend.points,
    };
  }

  async exportPdfReport(
    generatedById: string,
    type: ReportType,
    courseId?: string,
  ) {
    const uploader = await this.usersRepository.findOne({
      where: { id: generatedById },
    });
    const payload = await this.buildPdfPayload(type, courseId, uploader?.username ?? 'System');

    const reportsDir = join(process.cwd(), 'uploads', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    const fileName = `report-${Date.now()}.pdf`;
    const filePath = join(reportsDir, fileName);

    await this.generatePdf(filePath, payload);

    const report = this.reportsRepository.create({
      generatedBy: uploader ?? undefined,
      type,
      courseId,
      fileName,
      fileUrl: `http://localhost:3000/uploads/reports/${fileName}`,
      metadata: {
        scopeLabel: payload.scopeLabel,
        overview: payload.overview,
        performance: payload.performance,
        integrity: payload.integrity,
        assignments: payload.assignments.slice(0, 5),
      },
    });
    const saved = await this.reportsRepository.save(report);
    return {
      id: saved.id,
      generatedBy: uploader
        ? {
          id: uploader.id,
          username: uploader.username,
          role: uploader.role,
        }
        : null,
      type: saved.type,
      courseId: saved.courseId,
      fileUrl: saved.fileUrl,
      fileName: saved.fileName,
      metadata: saved.metadata,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
    };
  }

  private async buildPdfPayload(
    type: ReportType,
    courseId: string | undefined,
    generatedBy: string,
  ): Promise<PdfPayload> {
    const overview = await this.getOverview(courseId);
    const course = courseId
      ? await this.coursesRepository.findOne({
        where: { id: courseId },
        relations: { teacher: true, members: true },
      })
      : null;

    if (courseId && !course) {
      throw new NotFoundException('Course not found');
    }

    const assignments = await this.getAssignmentBreakdown(courseId);
    const verdictSummary = await this.getVerdictSummary(courseId);
    const submissions = await this.getSubmissions(courseId);

    // Performance Metrics
    const scores = submissions.map(s => s.score).filter(s => s !== null && s !== undefined) as number[];
    const excellent = scores.filter(s => s >= 80).length;
    const pass = scores.filter(s => s >= 50 && s < 80).length;
    const fail = scores.filter(s => s < 50).length;
    const totalWithScores = scores.length || 1;

    // Integrity Metrics
    const plagiarisms = await this.getPlagiarisms(courseId);
    const totalSim = plagiarisms.reduce((acc, p) => acc + p.similarity, 0);

    let hotspotAssignment: string | undefined;
    let hotspotCount = 0;
    assignments.forEach(a => {
      if (a.flaggedCount > hotspotCount) {
        hotspotCount = a.flaggedCount;
        hotspotAssignment = a.assignmentTitle;
      }
    });

    const violationList = verdictSummary.queue.map(q => ({
      studentId: q.studentId ?? 'N/A',
      fullName: q.student,
      similarity: q.similarity,
      source: 'Internal Match',
      penalty: q.verdict === 'Confirmed copy' ? 'Score Cancelled' : 'Under Review'
    }));

    return {
      reportTitle: this.resolveReportTitle(type),
      reportTypeLabel: this.formatReportType(type),
      scopeLabel: course
        ? `${course.name} (Teacher: ${course.teacher?.username ?? 'N/A'})`
        : 'All Courses',
      generatedBy,
      generatedAt: new Date().toISOString(),
      courseName: course?.name ?? 'All Courses',
      instructorName: course?.teacher?.username ?? 'System Admin',
      extractionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      overview,
      performance: {
        totalStudents: course?.members?.length ?? 0,
        totalValidSubmissions: submissions.length,
        averageScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
        rates: {
          excellent: Math.round((excellent / totalWithScores) * 100),
          pass: Math.round((pass / totalWithScores) * 100),
          fail: Math.round((fail / totalWithScores) * 100)
        }
      },
      integrity: {
        flaggedCount: overview.suspiciousRate > 0 ? Math.round(overview.totalSubmissions * (overview.suspiciousRate / 100)) : 0,
        avgSimilarity: plagiarisms.length ? Number(((totalSim / plagiarisms.length) * 100).toFixed(1)) : 0,
        confirmedCases: verdictSummary.confirmedCopyCount,
        warningCases: verdictSummary.needMoreReviewCount,
        dismissedCases: verdictSummary.validCount,
        hotspotAssignment,
        hotspotCount
      },
      assignments,
      violationList
    };
  }

  private async generatePdf(filePath: string, payload: PdfPayload) {
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = doc.pipe(createWriteStream(filePath));

      // 1. Header
      this.drawModernHeader(doc, payload);

      // 2. General Information
      this.drawGeneralInfo(doc, payload);

      // 3. Academic Performance Overview
      this.drawPerformanceSection(doc, payload);

      // 4. Academic Integrity Report
      this.drawIntegritySection(doc, payload);

      // 5. Detailed Analysis
      this.drawAssignmentTableExtended(doc, payload.assignments);

      // 6. Appendix
      this.drawViolationAppendix(doc, payload.violationList);

      // 7. Footer / Signature
      this.drawSignature(doc, payload);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', (error) => reject(error));
    });
  }

  private async getSubmissions(courseId?: string) {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.assignment', 'assignment')
      .leftJoinAndSelect('assignment.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course');
    if (courseId) {
      query.where('course.id = :courseId', { courseId });
    }
    return query.getMany();
  }

  private async getPlagiarisms(courseId?: string) {
    const query = this.plagiarismsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.submitVersionA', 'a')
      .leftJoinAndSelect('a.submission', 'sa')
      .leftJoinAndSelect('sa.assignment', 'assignment')
      .leftJoinAndSelect('assignment.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course');
    if (courseId) {
      query.where('course.id = :courseId', { courseId });
    }
    return query.getMany();
  }

  private async getAssignments(courseId?: string) {
    const query = this.assignmentsRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course');
    if (courseId) {
      query.where('course.id = :courseId', { courseId });
    }
    return query.getMany();
  }

  private async buildSubmissionTrendData(days: number, courseId?: string) {
    if (!Number.isInteger(days) || days <= 0 || days > 365) {
      throw new BadRequestException('Days must be an integer between 1 and 365');
    }

    const rangeEnd = new Date();
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const rangeStart = new Date(rangeEnd);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - days + 1);
    rangeStart.setUTCHours(0, 0, 0, 0);

    const query = this.submitVersionsRepository
      .createQueryBuilder('version')
      .innerJoin('version.submission', 'submission')
      .innerJoin('submission.assignment', 'assignment')
      .innerJoin('assignment.chapter', 'chapter')
      .innerJoin('chapter.course', 'course')
      .where('version.submittedAt BETWEEN :rangeStart AND :rangeEnd', {
        rangeStart,
        rangeEnd,
      })
      .orderBy('version.submittedAt', 'ASC');

    if (courseId) {
      query.andWhere('course.id = :courseId', { courseId });
    }

    const versions = await query.getMany();
    const trendMap = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(rangeStart);
      date.setUTCDate(rangeStart.getUTCDate() + i);
      trendMap.set(date.toISOString().slice(0, 10), 0);
    }

    versions.forEach((version) => {
      const key = version.submittedAt.toISOString().slice(0, 10);
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    });

    const points: TrendPoint[] = [...trendMap.entries()].map(([date, submissionCount]) => ({
      date,
      submissionCount,
    }));
    const totalSubmissions = points.reduce((sum, point) => sum + point.submissionCount, 0);
    const peakPoint = points.reduce(
      (peak, point) => (point.submissionCount > peak.submissionCount ? point : peak),
      points[0] ?? { date: rangeStart.toISOString().slice(0, 10), submissionCount: 0 },
    );

    return {
      range: {
        days,
        from: rangeStart.toISOString().slice(0, 10),
        to: rangeEnd.toISOString().slice(0, 10),
        granularity: 'day',
      },
      summary: {
        totalSubmissions,
        averagePerDay: Number((totalSubmissions / days).toFixed(2)),
        peakDate: peakPoint.date,
        peakSubmissionCount: peakPoint.submissionCount,
      },
      points,
    };
  }

  private async getAssignmentBreakdown(courseId?: string): Promise<AssignmentReportRow[]> {
    const query = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course')
      .leftJoinAndSelect('assignment.submissions', 'submission')
      .leftJoinAndSelect('submission.student', 'student')
      .orderBy('assignment.deadline', 'ASC');

    if (courseId) {
      query.where('course.id = :courseId', { courseId });
    }

    const assignments = await query.getMany();
    return assignments.map((assignment) => {
      const submissions = assignment.submissions ?? [];
      const uniqueStudents = new Set(
        submissions
          .map((submission) => submission.student?.id)
          .filter((studentId): studentId is string => Boolean(studentId)),
      ).size;
      const scores = submissions
        .map((submission) => submission.score)
        .filter((score): score is number => typeof score === 'number');

      return {
        assignmentTitle: assignment.title,
        chapterTitle: assignment.chapter?.title ?? 'N/A',
        status: assignment.status,
        submissionCount: submissions.length,
        uniqueStudents,
        averageScore: scores.length
          ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
          : 0,
        flaggedCount: submissions.filter((submission) => submission.plagiarismFlag).length,
        deadline: assignment.deadline.toISOString().slice(0, 10),
      };
    });
  }

  private async getVerdictSummary(courseId?: string) {
    const query = this.submissionsRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.student', 'student')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course')
      .where('submission.plagiarismFlag = :flag', { flag: true })
      .orderBy('submission.highestSimilarity', 'DESC');

    if (courseId) {
      query.andWhere('course.id = :courseId', { courseId });
    }

    const highRiskSubmissions = await query.getMany();
    const submissionIds = highRiskSubmissions.map((submission) => submission.id);
    const reviews = submissionIds.length
      ? await this.reviewsRepository.find({
        where: submissionIds.map((id) => ({ submission: { id } })),
        relations: { submission: true },
      })
      : [];

    const reviewMap = new Map(reviews.map((review) => [review.submission.id, review]));
    const verdictCounts = {
      confirmedCopy: 0,
      needMoreReview: 0,
      valid: 0,
    };

    reviews.forEach((review) => {
      if (review.verdict === ReviewVerdict.CONFIRMED_COPY) {
        verdictCounts.confirmedCopy += 1;
      } else if (review.verdict === ReviewVerdict.NEED_MORE_REVIEW) {
        verdictCounts.needMoreReview += 1;
      } else if (review.verdict === ReviewVerdict.VALID) {
        verdictCounts.valid += 1;
      }
    });

    const queue: Array<ReviewQueueRow & { studentId?: string }> = highRiskSubmissions.slice(0, 5).map((submission) => {
      const review = reviewMap.get(submission.id);
      return {
        studentId: submission.student?.id,
        student: submission.student?.username ?? 'Unknown student',
        assignment: submission.assignment?.title ?? 'Unknown assignment',
        similarity: Number(((submission.highestSimilarity ?? 0) * 100).toFixed(1)),
        verdict: review ? this.formatVerdict(review.verdict) : 'Pending review',
        reviewedAt: review?.reviewedAt ? review.reviewedAt.toISOString().slice(0, 10) : '-',
      };
    });

    return {
      highRiskCount: highRiskSubmissions.length,
      reviewedCount: reviews.length,
      pendingReviewCount: Math.max(highRiskSubmissions.length - reviews.length, 0),
      confirmedCopyCount: verdictCounts.confirmedCopy,
      needMoreReviewCount: verdictCounts.needMoreReview,
      validCount: verdictCounts.valid,
      queue,
    };
  }

  private buildRecommendations(
    overview: Awaited<ReturnType<StatisticsReportingService['getOverview']>>,
    trend: Awaited<ReturnType<StatisticsReportingService['buildSubmissionTrendData']>>,
    verdictSummary: Awaited<ReturnType<StatisticsReportingService['getVerdictSummary']>>,
    assignments: AssignmentReportRow[],
  ) {
    const recommendations: string[] = [];

    if (verdictSummary.pendingReviewCount > 0) {
      recommendations.push(
        `Complete manual review for ${verdictSummary.pendingReviewCount} unresolved high-risk submission(s) to keep the integrity queue under control.`,
      );
    }

    if (overview.suspiciousRate >= 10) {
      recommendations.push(
        `Similarity risk is currently ${overview.suspiciousRate}%, so prioritizing AST evidence review for top cases will reduce false positives.`,
      );
    }

    if (trend.summary.peakSubmissionCount > Math.max(3, trend.summary.averagePerDay * 2)) {
      recommendations.push(
        `Submission activity peaked on ${trend.summary.peakDate}; consider sending deadline reminders and scaling judge capacity around peak windows.`,
      );
    }

    const lowParticipation = assignments.find((assignment) => assignment.submissionCount === 0);
    if (lowParticipation) {
      recommendations.push(
        `${lowParticipation.assignmentTitle} has no submissions yet, so the teaching team should verify assignment visibility and learner communication.`,
      );
    }

    if (recommendations.length < 3) {
      recommendations.push(
        'Maintain the current review cadence and continue monitoring both score outcomes and resubmission patterns for early risk detection.',
      );
    }

    return recommendations.slice(0, 4);
  }

  private buildSimilarityDistribution(plagiarisms: Plagiarism[]) {
    const buckets = {
      low: 0,
      medium: 0,
      high: 0,
    };

    plagiarisms.forEach((item) => {
      if (item.similarity < 0.4) {
        buckets.low += 1;
      } else if (item.similarity < 0.7) {
        buckets.medium += 1;
      } else {
        buckets.high += 1;
      }
    });

    return [
      { label: 'Low (<40%)', value: buckets.low },
      { label: 'Medium (40%-70%)', value: buckets.medium },
      { label: 'High (>70%)', value: buckets.high },
    ];
  }

  private resolveReportTitle(type: ReportType) {
    return type === ReportType.LEARNING_QUALITY
      ? 'Learning Quality Report'
      : 'Academic Integrity Report';
  }

  private formatReportType(type: ReportType) {
    return type === ReportType.LEARNING_QUALITY
      ? 'Learning Quality'
      : 'Academic Integrity';
  }

  private formatVerdict(verdict: ReviewVerdict) {
    if (verdict === ReviewVerdict.CONFIRMED_COPY) {
      return 'Confirmed copy';
    }
    if (verdict === ReviewVerdict.VALID) {
      return 'Valid';
    }
    return 'Need more review';
  }

  private ensurePageSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
    if (doc.y + neededHeight > doc.page.height - 45) {
      doc.addPage();
    }
  }

  private drawModernHeader(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(22).text('QUALITY & ACADEMIC INTEGRITY', 40, 50, { align: 'center' });
    doc.fontSize(18).text('EVALUATION REPORT', 40, 75, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#4B5563').text('Course Management & Automated Grading System', 40, 100, { align: 'center' });
    doc.moveTo(40, 120).lineTo(doc.page.width - 40, 120).strokeColor('#111827').lineWidth(1.5).stroke();
    doc.y = 140;
  }

  private drawGeneralInfo(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.drawSectionTitleConcept(doc, '1. General Information');
    const startX = 60;
    const labelWidth = 140;

    const fields = [
      { label: 'Course:', value: payload.courseName },
      { label: 'Instructor in Charge:', value: payload.instructorName },
      { label: 'Reporting Period:', value: 'Semester 1, Academic Year 2025 - 2026' },
      { label: 'Extraction Date:', value: payload.extractionDate },
      { label: 'Report Objective:', value: 'Final term evaluation and review of examination rule violations.' }
    ];

    fields.forEach(f => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(f.label, startX, doc.y, { width: labelWidth });
      const valY = doc.y - 12;
      doc.font('Helvetica').text(f.value, startX + labelWidth, valY, { width: doc.page.width - startX - labelWidth - 40 });
      doc.moveDown(0.2);
    });
    doc.moveDown(0.8);
  }

  private drawPerformanceSection(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.drawSectionTitleConcept(doc, '2. Academic Performance Overview');
    const startX = 60;
    const perf = payload.performance;

    const listItems = [
      { label: 'Total Enrolled Students:', value: `${perf.totalStudents} students` },
      { label: 'Total Assignments:', value: `${payload.overview.totalAssignments} assignments` },
      { label: 'Total Valid Submissions:', value: `${perf.totalValidSubmissions} submissions` },
      { label: 'Overall Average Score:', value: `${perf.averageScore} / 100`, isBold: true },
    ];

    listItems.forEach(item => {
      doc.circle(startX - 10, doc.y + 5, 2).fill('#374151');
      doc.font('Helvetica-Bold').fontSize(9).text(item.label, startX, doc.y - 5);
      doc.font(item.isBold ? 'Helvetica-Bold' : 'Helvetica').text(item.value, startX + 150, doc.y - 9);
      doc.moveDown(0.5);
    });

    doc.font('Helvetica-Bold').text('Pass / Fail Rate:', startX, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fillColor('#4B5563');
    doc.text(`- Excellent (>= 80 pts): ${perf.rates.excellent}%`, startX + 20, doc.y);
    doc.text(`- Pass (50 pts - 79 pts): ${perf.rates.pass}%`, startX + 20, doc.y + 12);
    doc.text(`- Fail (< 50 pts): ${perf.rates.fail}%`, startX + 20, doc.y + 24);
    doc.y += 40;
  }

  private drawIntegritySection(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.drawSectionTitleConcept(doc, '3. Academic Integrity Report');
    const startX = 60;
    const integ = payload.integrity;

    doc.circle(startX - 10, doc.y + 5, 2).fill('#EF4444');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#EF4444').text('Total Flagged Submissions (High-Risk):', startX, doc.y - 5);
    doc.text(`${integ.flaggedCount} submissions`, startX + 200, doc.y - 9);
    doc.moveDown(0.5);

    doc.circle(startX - 10, doc.y + 5, 2).fill('#374151');
    doc.font('Helvetica-Bold').fillColor('#374151').text('Average Source Code Similarity Rate:', startX, doc.y - 5);
    doc.font('Helvetica').text(`${integ.avgSimilarity}% (Safe Level)`, startX + 200, doc.y - 9);
    doc.moveDown(0.5);

    doc.circle(startX - 10, doc.y + 5, 2).fill('#374151');
    doc.font('Helvetica-Bold').text('Disciplinary Action Statistics:', startX, doc.y - 5);
    doc.moveDown(0.3);
    doc.font('Helvetica').fillColor('#4B5563');
    doc.text(`RED Confirmed Plagiarism: ${integ.confirmedCases} cases`, startX + 20, doc.y);
    doc.text(`YELLOW Warning / Reminder: ${integ.warningCases} cases`, startX + 20, doc.y + 12);
    doc.text(`GREEN Dismissed: ${integ.dismissedCases} cases`, startX + 20, doc.y + 24);
    doc.y += 40;

    if (integ.hotspotAssignment) {
      doc.roundedRect(startX, doc.y - 10, 480, 45, 4).fillAndStroke('#F9FAFB', '#E5E7EB');
      doc.fillColor('#111827').font('Helvetica-Bold').text('HOTSPOT:', startX + 10, doc.y);
      doc.font('Helvetica-Oblique').text(`The assignment with the highest violation rate is ${integ.hotspotAssignment} with ${integ.hotspotCount} flagged cases.`, startX + 80, doc.y, { width: 380 });
      doc.y += 60;
    }
  }

  private drawAssignmentTableExtended(doc: PDFKit.PDFDocument, assignments: AssignmentReportRow[]) {
    this.drawSectionTitleConcept(doc, '4. Detailed Analysis by Assignment');
    const rows = assignments.map((a, i) => [
      `A${i + 1}`,
      a.assignmentTitle,
      `${Math.round((a.submissionCount / (a.uniqueStudents || 1)) * 100)}%`,
      String(a.averageScore),
      a.flaggedCount > 0 ? `${a.flaggedCount} Cases` : '0'
    ]);

    this.drawTable(doc, ['ID', 'Assignment Name', 'Rate', 'Avg Score', 'Violations'], [40, 200, 60, 60, 100], rows);
  }

  private drawViolationAppendix(doc: PDFKit.PDFDocument, violations: PdfPayload['violationList']) {
    this.ensurePageSpace(doc, 200);
    this.drawSectionTitleConcept(doc, '5. Appendix: Violation List');
    const rows = violations.length ? violations.map(v => [
      v.studentId,
      v.fullName,
      `${v.similarity}%`,
      v.source,
      v.penalty
    ]) : [['-', 'No confirmed violations', '-', '-', '-']];

    this.drawTable(doc, ['Student ID', 'Full Name', 'Sim', 'Source', 'Penalty'], [70, 120, 40, 120, 130], rows);
  }

  private drawSignature(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.ensurePageSpace(doc, 150);
    doc.y += 40;
    const rightX = doc.page.width - 250;
    doc.fillColor('#374151').font('Helvetica-Oblique').fontSize(9).text(payload.extractionDate, rightX, doc.y, { align: 'center', width: 200 });
    doc.font('Helvetica-Bold').fontSize(10).text('Instructor in Charge', rightX, doc.y + 20, { align: 'center', width: 200 });
    doc.moveDown(5);
    doc.font('Helvetica').text(payload.instructorName, rightX, doc.y, { align: 'center', width: 200 });
  }

  private drawSectionTitleConcept(doc: PDFKit.PDFDocument, title: string) {
    this.ensurePageSpace(doc, 50);
    doc.rect(40, doc.y, 4, 18).fill('#2563EB');
    doc.fillColor('#1F2937').font('Helvetica-Bold').fontSize(12).text(title, 50, doc.y + 3);
    doc.y += 20;
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    widths: number[],
    rows: string[][],
  ) {
    const startX = 40;
    const rowHeight = 25;
    const drawHeader = () => {
      let x = startX;
      doc.fillColor('#F9FAFB').rect(startX, doc.y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill();
      headers.forEach((header, index) => {
        doc
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(header, x + 6, doc.y + 8, { width: widths[index] - 12 });
        x += widths[index];
      });
      doc.y += rowHeight;
    };

    drawHeader();
    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    rows.forEach((row) => {
      if (doc.y + rowHeight > doc.page.height - 45) {
        doc.addPage();
        drawHeader();
      }

      let x = startX;
      widths.forEach((width, index) => {
        doc.rect(x, doc.y, width, rowHeight).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        doc.text(row[index] ?? '', x + 6, doc.y + 8, { width: width - 12, ellipsis: true });
        x += width;
      });
      doc.y += rowHeight;
    });
    doc.moveDown(0.8);
  }
}

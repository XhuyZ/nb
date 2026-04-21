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
  overview: Awaited<ReturnType<StatisticsReportingService['getOverview']>>;
  trend: Awaited<ReturnType<StatisticsReportingService['buildSubmissionTrendData']>>;
  verdictSummary: Awaited<ReturnType<StatisticsReportingService['getVerdictSummary']>>;
  assignments: AssignmentReportRow[];
  recommendations: string[];
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
  ) {}

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
        trend: payload.trend,
        verdictSummary: payload.verdictSummary,
        topAssignments: payload.assignments.slice(0, 5),
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
          relations: { teacher: true },
        })
      : null;

    if (courseId && !course) {
      throw new NotFoundException('Course not found');
    }

    const trend = await this.buildSubmissionTrendData(30, courseId);
    const verdictSummary = await this.getVerdictSummary(courseId);
    const assignments = await this.getAssignmentBreakdown(courseId);
    const recommendations = this.buildRecommendations(overview, trend, verdictSummary, assignments);

    return {
      reportTitle: this.resolveReportTitle(type),
      reportTypeLabel: this.formatReportType(type),
      scopeLabel: course
        ? `${course.name} (Teacher: ${course.teacher?.username ?? 'N/A'})`
        : 'All courses',
      generatedBy,
      generatedAt: new Date().toISOString(),
      courseName: course?.name ?? 'All courses',
      overview,
      trend,
      verdictSummary,
      assignments,
      recommendations,
    };
  }

  private async generatePdf(filePath: string, payload: PdfPayload) {
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const stream = doc.pipe(createWriteStream(filePath));
      const cards: PdfMetricCard[] = [
        {
          label: 'Total Assignments',
          value: String(payload.overview.totalAssignments),
          hint: `${payload.overview.totalCourses} course scope`,
        },
        {
          label: 'Total Submissions',
          value: String(payload.overview.totalSubmissions),
          hint: `${payload.trend.summary.totalSubmissions} versions in last 30 days`,
        },
        {
          label: 'Suspicious Rate',
          value: `${payload.overview.suspiciousRate}%`,
          hint: `${payload.verdictSummary.highRiskCount} high-risk cases`,
        },
        {
          label: 'Pending Reviews',
          value: String(payload.verdictSummary.pendingReviewCount),
          hint: `${payload.verdictSummary.reviewedCount} reviewed cases`,
        },
      ];

      this.drawHeader(doc, payload);
      this.drawMetricCards(doc, cards);
      this.drawOverviewSection(doc, payload);
      this.drawTrendSection(doc, payload.trend.points, payload.trend.summary.peakDate);
      this.drawRiskSection(doc, payload);
      this.drawAssignmentSection(doc, payload.assignments);
      this.drawReviewQueueSection(doc, payload.verdictSummary.queue);
      this.drawRecommendationsSection(doc, payload.recommendations);

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

    const queue: ReviewQueueRow[] = highRiskSubmissions.slice(0, 5).map((submission) => {
      const review = reviewMap.get(submission.id);
      return {
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

  private drawHeader(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    doc
      .roundedRect(40, 40, doc.page.width - 80, 92, 10)
      .fillAndStroke('#EFF6FF', '#BFDBFE');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(22).text(payload.reportTitle, 56, 58);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#334155')
      .text(`Report type: ${payload.reportTypeLabel}`, 56, 90)
      .text(`Scope: ${payload.scopeLabel}`, 56, 106)
      .text(`Generated by: ${payload.generatedBy}`, 340, 90)
      .text(`Generated at: ${payload.generatedAt.slice(0, 19).replace('T', ' ')}`, 340, 106);
    doc.moveTo(40, 145).strokeColor('#E2E8F0').lineTo(doc.page.width - 40, 145).stroke();
    doc.y = 160;
  }

  private drawMetricCards(doc: PDFKit.PDFDocument, cards: PdfMetricCard[]) {
    const startX = 40;
    const gap = 16;
    const cardWidth = (doc.page.width - 80 - gap) / 2;
    const cardHeight = 66;

    cards.forEach((card, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + column * (cardWidth + gap);
      const y = doc.y + row * (cardHeight + 12);

      doc.roundedRect(x, y, cardWidth, cardHeight, 8).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.fillColor('#64748B').font('Helvetica').fontSize(9).text(card.label, x + 14, y + 12);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(card.value, x + 14, y + 28);
      doc.fillColor('#475569').font('Helvetica').fontSize(9).text(card.hint, x + 14, y + 48);
    });

    doc.y += Math.ceil(cards.length / 2) * (cardHeight + 12) + 8;
  }

  private drawOverviewSection(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.ensurePageSpace(doc, 120);
    this.drawSectionTitle(doc, 'Executive Summary');

    const completion = payload.overview.submissionCompletion;
    const summaryLines = [
      `The selected scope covers ${payload.overview.totalAssignments} assignment(s) across ${payload.overview.totalCourses} course(s).`,
      `${payload.overview.totalSubmissions} submission record(s) are currently stored, with ${completion.completionRate}% completion against the assignment baseline.`,
      `${payload.verdictSummary.highRiskCount} high-risk submission(s) were detected, and ${payload.verdictSummary.reviewedCount} of them already have a review verdict.`,
    ];

    summaryLines.forEach((line) => {
      doc.circle(46, doc.y + 5, 2).fill('#2563EB');
      doc.fillColor('#1E293B').font('Helvetica').fontSize(10).text(line, 56, doc.y);
      doc.moveDown(0.6);
    });
    doc.moveDown(0.5);
  }

  private drawTrendSection(doc: PDFKit.PDFDocument, points: TrendPoint[], peakDate: string) {
    this.ensurePageSpace(doc, 220);
    this.drawSectionTitle(doc, 'Submission Trend Snapshot');

    const chartPoints = points.slice(-14);
    const chartX = 48;
    const chartY = doc.y + 8;
    const chartWidth = doc.page.width - 96;
    const chartHeight = 120;
    const maxValue = Math.max(...chartPoints.map((point) => point.submissionCount), 1);
    const barGap = 6;
    const barWidth = (chartWidth - barGap * (chartPoints.length - 1)) / Math.max(chartPoints.length, 1);

    doc.rect(chartX, chartY, chartWidth, chartHeight).strokeColor('#CBD5E1').stroke();

    chartPoints.forEach((point, index) => {
      const barHeight = (point.submissionCount / maxValue) * (chartHeight - 24);
      const x = chartX + index * (barWidth + barGap);
      const y = chartY + chartHeight - barHeight - 16;

      doc.rect(x, y, Math.max(barWidth, 2), barHeight).fill('#60A5FA');
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(7)
        .text(point.date.slice(5), x, chartY + chartHeight - 12, {
          width: Math.max(barWidth, 12),
          align: 'center',
        });
    });

    doc.y = chartY + chartHeight + 10;
    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(10)
      .text(
        `Peak activity was recorded on ${peakDate}. The chart above shows the last ${chartPoints.length} day(s) of submission version activity.`,
      );
    doc.moveDown();
  }

  private drawRiskSection(doc: PDFKit.PDFDocument, payload: PdfPayload) {
    this.ensurePageSpace(doc, 170);
    this.drawSectionTitle(doc, 'Risk and Verdict Summary');

    const distribution = payload.overview.plagiarismDistribution as Array<{
      label: string;
      value: number;
    }>;

    const leftX = 40;
    const rightX = doc.page.width / 2 + 8;
    const boxWidth = doc.page.width / 2 - 48;
    const startY = doc.y;

    doc.roundedRect(leftX, startY, boxWidth, 110, 8).fillAndStroke('#FFFFFF', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text('Similarity Distribution', leftX + 14, startY + 12);
    distribution.forEach((item, index) => {
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(10)
        .text(`${item.label}: ${item.value}`, leftX + 14, startY + 38 + index * 20);
    });

    doc.roundedRect(rightX, startY, boxWidth, 110, 8).fillAndStroke('#FFFFFF', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text('Verdict Overview', rightX + 14, startY + 12);
    const verdictLines = [
      `Confirmed copy: ${payload.verdictSummary.confirmedCopyCount}`,
      `Need more review: ${payload.verdictSummary.needMoreReviewCount}`,
      `Valid after review: ${payload.verdictSummary.validCount}`,
      `Pending review: ${payload.verdictSummary.pendingReviewCount}`,
    ];
    verdictLines.forEach((line, index) => {
      doc.fillColor('#334155').font('Helvetica').fontSize(10).text(line, rightX + 14, startY + 38 + index * 18);
    });

    doc.y = startY + 126;
  }

  private drawAssignmentSection(doc: PDFKit.PDFDocument, assignments: AssignmentReportRow[]) {
    this.ensurePageSpace(doc, 180);
    this.drawSectionTitle(doc, 'Assignment Breakdown');

    const rows = assignments.map((assignment) => [
      assignment.assignmentTitle,
      String(assignment.submissionCount),
      String(assignment.uniqueStudents),
      assignment.averageScore.toFixed(1),
      String(assignment.flaggedCount),
      assignment.deadline,
    ]);

    this.drawTable(
      doc,
      ['Assignment', 'Subs', 'Students', 'Avg score', 'Flags', 'Deadline'],
      [170, 48, 58, 58, 44, 72],
      rows,
    );
  }

  private drawReviewQueueSection(doc: PDFKit.PDFDocument, queue: ReviewQueueRow[]) {
    this.ensurePageSpace(doc, 170);
    this.drawSectionTitle(doc, 'High-Risk Review Queue');

    const rows = queue.length
      ? queue.map((item) => [
          item.student,
          item.assignment,
          `${item.similarity}%`,
          item.verdict,
          item.reviewedAt,
        ])
      : [['No high-risk submissions', '-', '-', '-', '-']];

    this.drawTable(
      doc,
      ['Student', 'Assignment', 'Similarity', 'Verdict', 'Reviewed at'],
      [82, 172, 62, 96, 70],
      rows,
    );
  }

  private drawRecommendationsSection(doc: PDFKit.PDFDocument, recommendations: string[]) {
    this.ensurePageSpace(doc, 140);
    this.drawSectionTitle(doc, 'Recommended Actions');

    recommendations.forEach((item) => {
      doc.circle(46, doc.y + 5, 2).fill('#2563EB');
      doc.fillColor('#1E293B').font('Helvetica').fontSize(10).text(item, 56, doc.y, {
        width: doc.page.width - 100,
      });
      doc.moveDown(0.7);
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(13).text(title);
    doc.moveTo(40, doc.y + 4).strokeColor('#E2E8F0').lineTo(doc.page.width - 40, doc.y + 4).stroke();
    doc.moveDown(0.6);
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    widths: number[],
    rows: string[][],
  ) {
    const startX = 40;
    const rowHeight = 22;
    const drawHeader = () => {
      let x = startX;
      doc.fillColor('#F8FAFC').rect(startX, doc.y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill();
      headers.forEach((header, index) => {
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(header, x + 6, doc.y + 7, { width: widths[index] - 12 });
        x += widths[index];
      });
      doc.y += rowHeight;
    };

    drawHeader();

    rows.forEach((row) => {
      if (doc.y + rowHeight > doc.page.height - 45) {
        doc.addPage();
        drawHeader();
      }

      let x = startX;
      doc.strokeColor('#E2E8F0');
      widths.forEach((width, index) => {
        doc.rect(x, doc.y, width, rowHeight).stroke();
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8)
          .text(row[index] ?? '', x + 6, doc.y + 7, { width: width - 12, ellipsis: true });
        x += width;
      });
      doc.y += rowHeight;
    });

    doc.moveDown(0.8);
  }
}

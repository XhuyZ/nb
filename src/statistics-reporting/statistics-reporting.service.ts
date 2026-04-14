import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { AcademicReport, ReportType } from './entities/academic-report.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class StatisticsReportingService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismsRepository: Repository<Plagiarism>,
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

  async exportPdfReport(
    generatedById: string,
    type: ReportType,
    courseId?: string,
  ) {
    const overview = await this.getOverview(courseId);
    const visualization = await this.getVisualizationData(courseId);
    const uploader = await this.usersRepository.findOne({
      where: { id: generatedById },
    });

    const reportsDir = join(process.cwd(), 'uploads', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    const fileName = `report-${Date.now()}.pdf`;
    const filePath = join(reportsDir, fileName);

    await this.generatePdf(filePath, {
      type,
      courseId: courseId ?? 'all',
      overview,
      visualization,
    });

    const report = this.reportsRepository.create({
      generatedBy: uploader ?? undefined,
      type,
      courseId,
      fileName,
      fileUrl: `http://localhost:3000/uploads/reports/${fileName}`,
      metadata: {
        overview,
        visualization,
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

  private async generatePdf(
    filePath: string,
    payload: {
      type: ReportType;
      courseId: string;
      overview: Record<string, unknown>;
      visualization: Record<string, unknown>;
    },
  ) {
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const stream = doc.pipe(createWriteStream(filePath));
      doc.fontSize(18).text('Academic Integrity Report', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Report type: ${payload.type}`);
      doc.text(`Course filter: ${payload.courseId}`);
      doc.moveDown();
      doc.fontSize(13).text('Overview');
      doc.fontSize(10).text(JSON.stringify(payload.overview, null, 2));
      doc.moveDown();
      doc.fontSize(13).text('Visualization Data');
      doc.fontSize(10).text(JSON.stringify(payload.visualization, null, 2));
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
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { User } from 'src/users/entities/user.entity';
import { AcademicReport } from './entities/academic-report.entity';
import { StatisticsReportingController } from './statistics-reporting.controller';
import { StatisticsReportingService } from './statistics-reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Submission,
      Plagiarism,
      Assignment,
      Course,
      AcademicReport,
      User,
    ]),
  ],
  controllers: [StatisticsReportingController],
  providers: [StatisticsReportingService],
  exports: [TypeOrmModule],
})
export class StatisticsReportingModule {}

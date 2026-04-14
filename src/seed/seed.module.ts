import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentDocument } from 'src/assignments/entities/assignment-document.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { Chapter } from 'src/courses/entities/chapter.entity';
import { CourseMember } from 'src/courses/entities/course-member.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { PlagiarismReview } from 'src/review-verdict/entities/plagiarism-review.entity';
import { AcademicReport } from 'src/statistics-reporting/entities/academic-report.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { SubmissionTestResult } from 'src/submissions/entities/submission-test-result.entity';
import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import { User } from 'src/users/entities/user.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Assignment,
      Course,
      Chapter,
      CourseMember,
      AcademicReport,
      AssignmentDocument,
      AssignmentTestCase,
      Submission,
      SubmissionTestResult,
      SubmitVersion,
      Plagiarism,
      PlagiarismReview,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}

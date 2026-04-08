import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { User } from 'src/users/entities/user.entity';
import { SubmissionTestResult } from './entities/submission-test-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Submission,
      Assignment,
      AssignmentTestCase,
      SubmitVersion,
      Plagiarism,
      User,
      SubmissionTestResult,
    ]),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [TypeOrmModule],
})
export class SubmissionsModule {}

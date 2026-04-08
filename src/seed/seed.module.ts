import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentDocument } from 'src/assignments/entities/assignment-document.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';
import { Assignment } from 'src/assignments/entities/assignment.entity';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
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
      AssignmentDocument,
      AssignmentTestCase,
      Submission,
      SubmissionTestResult,
      SubmitVersion,
      Plagiarism,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}

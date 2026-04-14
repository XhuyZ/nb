import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { User } from 'src/users/entities/user.entity';
import { ReviewVerdictController } from './review-verdict.controller';
import { PlagiarismReview } from './entities/plagiarism-review.entity';
import { ReviewVerdictService } from './review-verdict.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Plagiarism, PlagiarismReview, User]),
  ],
  controllers: [ReviewVerdictController],
  providers: [ReviewVerdictService],
  exports: [TypeOrmModule],
})
export class ReviewVerdictModule {}

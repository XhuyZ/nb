import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { ReviewVerdictDto } from './dto/review-verdict.dto';
import {
  PlagiarismReview,
  ReviewVerdict,
} from './entities/plagiarism-review.entity';

@Injectable()
export class ReviewVerdictService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismsRepository: Repository<Plagiarism>,
    @InjectRepository(PlagiarismReview)
    private readonly reviewsRepository: Repository<PlagiarismReview>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  async getHighRiskSubmissions(courseId?: string) {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.student', 'student')
      .leftJoinAndSelect('s.assignment', 'assignment')
      .leftJoinAndSelect('assignment.chapter', 'chapter')
      .leftJoinAndSelect('chapter.course', 'course')
      .where('s.plagiarismFlag = :flag', { flag: true })
      .orderBy('s.highestSimilarity', 'DESC');

    if (courseId) {
      query.andWhere('course.id = :courseId', { courseId });
    }

    const submissions = await query.getMany();
    const ids = submissions.map((item) => item.id);
    const reviews = ids.length
      ? await this.reviewsRepository.find({
        where: ids.map((id) => ({ submission: { id } })),
        relations: { reviewer: true, submission: true },
      })
      : [];
    const reviewMap = new Map(
      reviews.map((review) => [review.submission.id, review]),
    );

    return submissions.map((submission) => ({
      submissionId: submission.id,
      student: submission.student?.username,
      assignment: submission.assignment?.title,
      course: submission.assignment?.chapter?.course?.name ?? null,
      highestSimilarity: submission.highestSimilarity ?? 0,
      status: reviewMap.get(submission.id)?.verdict ?? ReviewVerdict.NEED_MORE_REVIEW,
      reviewNote: reviewMap.get(submission.id)?.note ?? null,
    }));
  }

  async getReviewDetails(submissionId: string, requesterId: string, role: UserRole) {
    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: {
        student: true,
        assignment: {
          teacher: true,
        },
      },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (role === UserRole.TEACHER && submission.assignment?.teacher?.id !== requesterId) {
      throw new ForbiddenException('Cannot review submissions outside your classes');
    }

    const review = await this.reviewsRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: { reviewer: true },
    });

    const plagiarismMatches = await this.plagiarismsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.submitVersionA', 'a')
      .leftJoinAndSelect('p.submitVersionB', 'b')
      .leftJoinAndSelect('a.submission', 'sa')
      .leftJoinAndSelect('b.submission', 'sb')
      .where('sa.id = :submissionId OR sb.id = :submissionId', { submissionId })
      .orderBy('p.similarity', 'DESC')
      .getMany();

    return {
      submissionId,
      verdict: review?.verdict ?? ReviewVerdict.NEED_MORE_REVIEW,
      note: review?.note ?? null,
      reviewer: review?.reviewer?.username ?? null,
      reviewedAt: review?.reviewedAt ?? null,
      matches: plagiarismMatches.map((match) => ({
        plagiarismId: match.id,
        similarity: match.similarity,
        highRisk: match.highRisk,
        evidence: match.evidence ?? { commonTokens: [], commonLines: [] },
      })),
    };
  }

  async upsertVerdict(
    submissionId: string,
    reviewerId: string,
    role: UserRole,
    dto: ReviewVerdictDto,
  ) {
    if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teacher/admin can set verdict');
    }

    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: { assignment: { teacher: true } },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (role === UserRole.TEACHER && submission.assignment?.teacher?.id !== reviewerId) {
      throw new ForbiddenException('Cannot set verdict outside your classes');
    }

    const reviewer = await this.usersRepository.findOne({ where: { id: reviewerId } });
    let review = await this.reviewsRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: { submission: true },
    });

    if (!review) {
      review = this.reviewsRepository.create({ submission });
    }

    review.verdict = dto.verdict;
    review.note = dto.note;
    review.reviewer = reviewer ?? undefined;
    review.reviewedAt = new Date();
    const savedReview = await this.reviewsRepository.save(review);

    if (dto.verdict === ReviewVerdict.CLEAN) {
      submission.plagiarismFlag = false;
      submission.highestSimilarity = 0;
      await this.submissionsRepository.save(submission);
    } else if (dto.verdict === ReviewVerdict.CONFIRMED_COPY) {
      submission.plagiarismFlag = true;
      await this.submissionsRepository.save(submission);
    }

    return savedReview;
  }
}

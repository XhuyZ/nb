import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { UserRole } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class EvidenceChainService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Plagiarism)
    private readonly plagiarismsRepository: Repository<Plagiarism>,
  ) {}

  async getEvidenceChain(submissionId: string, requesterId: string, role: UserRole) {
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

    if (role === UserRole.STUDENT && submission.student?.id !== requesterId) {
      throw new ForbiddenException('Cannot view evidence of another student');
    }
    if (role === UserRole.TEACHER && submission.assignment?.teacher?.id !== requesterId) {
      throw new ForbiddenException('Cannot view evidence outside your assignment');
    }

    const matches = await this.plagiarismsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.submitVersionA', 'a')
      .leftJoinAndSelect('a.submission', 'sa')
      .leftJoinAndSelect('sa.student', 'studentA')
      .leftJoinAndSelect('p.submitVersionB', 'b')
      .leftJoinAndSelect('b.submission', 'sb')
      .leftJoinAndSelect('sb.student', 'studentB')
      .where('sa.id = :submissionId OR sb.id = :submissionId', { submissionId })
      .orderBy('p.similarity', 'DESC')
      .getMany();

    return {
      submissionId,
      generatedAt: new Date().toISOString(),
      chain: matches.map((match) => ({
        plagiarismId: match.id,
        similarity: match.similarity,
        highRisk: match.highRisk,
        evidence: match.evidence ?? { commonTokens: [], commonLines: [] },
        pair: {
          submissionAId: match.submitVersionA?.submission?.id,
          studentA: match.submitVersionA?.submission?.student?.username,
          submittedAtA: match.submitVersionA?.submittedAt,
          submissionBId: match.submitVersionB?.submission?.id,
          studentB: match.submitVersionB?.submission?.student?.username,
          submittedAtB: match.submitVersionB?.submittedAt,
        },
      })),
    };
  }
}

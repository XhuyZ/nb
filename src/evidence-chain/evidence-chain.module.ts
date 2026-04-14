import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { EvidenceChainController } from './evidence-chain.controller';
import { EvidenceChainService } from './evidence-chain.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Plagiarism])],
  controllers: [EvidenceChainController],
  providers: [EvidenceChainService],
  exports: [TypeOrmModule],
})
export class EvidenceChainModule {}

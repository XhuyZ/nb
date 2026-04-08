import { Module } from '@nestjs/common';
import { PlagiarismsService } from './plagiarisms.service';
import { PlagiarismsController } from './plagiarisms.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plagiarism } from './entities/plagiarism.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Plagiarism])],
  controllers: [PlagiarismsController],
  providers: [PlagiarismsService],
  exports: [TypeOrmModule],
})
export class PlagiarismsModule {}

import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from './entities/assignment.entity';
import { User } from 'src/users/entities/user.entity';
import { AssignmentDocument } from './entities/assignment-document.entity';
import { AssignmentTestCase } from './entities/assignment-test-case.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Assignment, User, AssignmentDocument, AssignmentTestCase]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [TypeOrmModule],
})
export class AssignmentsModule {}

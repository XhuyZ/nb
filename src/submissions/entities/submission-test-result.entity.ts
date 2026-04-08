import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import { AssignmentTestCase } from 'src/assignments/entities/assignment-test-case.entity';

@Entity('submission_test_results')
export class SubmissionTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (submission) => submission.testResults)
  submission: Submission;

  @ManyToOne(() => SubmitVersion, { nullable: true })
  submitVersion?: SubmitVersion;

  @ManyToOne(() => AssignmentTestCase, { nullable: true })
  testCase?: AssignmentTestCase;

  @Column({ default: false })
  passed: boolean;

  @Column({ type: 'text', nullable: true })
  actualOutput?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  executionTimeMs: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

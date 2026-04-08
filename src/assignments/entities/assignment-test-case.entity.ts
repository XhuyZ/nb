import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Assignment } from './assignment.entity';

@Entity('assignment_test_cases')
export class AssignmentTestCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.testCases)
  assignment: Assignment;

  @Column({ type: 'text' })
  input: string;

  @Column({ type: 'text' })
  expectedOutput: string;

  @Column({ default: false })
  isSample: boolean;

  @Column({ type: 'int', default: 1 })
  weight: number;

  @Column({ type: 'int', default: 1 })
  orderIndex: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportType {
  ACADEMIC_INTEGRITY = 'academic_integrity',
  LEARNING_QUALITY = 'learning_quality',
}

@Entity('academic_reports')
export class AcademicReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  generatedBy?: User;

  @Column({
    type: 'enum',
    enum: ReportType,
    default: ReportType.ACADEMIC_INTEGRITY,
  })
  type: ReportType;

  @Column({ nullable: true })
  courseId?: string;

  @Column()
  fileUrl: string;

  @Column()
  fileName: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

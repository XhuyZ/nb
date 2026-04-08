import { Plagiarism } from 'src/plagiarisms/entities/plagiarism.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SubmitVersionStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('submit_versions')
export class SubmitVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (submission) => submission.versions)
  submission: Submission;

  @Column()
  version: number;

  @Column({ type: 'text', nullable: true })
  codeSnapshot: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  fileMimeType: string;

  @Column({ type: 'int', nullable: true })
  fileSize: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({
    type: 'enum',
    enum: SubmitVersionStatus,
    default: SubmitVersionStatus.ACTIVE,
  })
  status: SubmitVersionStatus;

  @OneToMany(() => Plagiarism, (p) => p.submitVersionA)
  plagiarismA: Plagiarism[];

  @OneToMany(() => Plagiarism, (p) => p.submitVersionB)
  plagiarismB: Plagiarism[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

import { Submission } from 'src/submissions/entities/submission.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReviewVerdict {
  CONFIRMED_COPY = 'confirmed_copy',
  NEED_MORE_REVIEW = 'need_more_review',
  VALID = 'valid',
}

@Entity('plagiarism_reviews')
export class PlagiarismReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Submission, { onDelete: 'CASCADE' })
  @JoinColumn()
  submission: Submission;

  @ManyToOne(() => User, { nullable: true })
  reviewer?: User;

  @Column({
    type: 'enum',
    enum: ReviewVerdict,
    default: ReviewVerdict.NEED_MORE_REVIEW,
  })
  verdict: ReviewVerdict;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

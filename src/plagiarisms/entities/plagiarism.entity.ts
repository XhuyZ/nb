import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plagiarisms')
export class Plagiarism {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SubmitVersion, (sv) => sv.plagiarismA)
  submitVersionA: SubmitVersion;

  @ManyToOne(() => SubmitVersion, (sv) => sv.plagiarismB)
  submitVersionB: SubmitVersion;

  @Column('float')
  similarity: number;

  @Column({ default: false })
  highRisk: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

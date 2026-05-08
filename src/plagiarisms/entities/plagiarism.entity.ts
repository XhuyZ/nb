import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface EvidenceSegment {
  title: string;
  description: string;
  similarity: number;
  linesA: [number, number];
  linesB: [number, number];
  snippetA?: string;
  snippetB?: string;
}

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

  @Column({ type: 'jsonb', nullable: true })
  evidence?: {
    commonTokens: string[];
    commonLines: string[];
    astNodesA?: string[];
    astNodesB?: string[];
    segments?: EvidenceSegment[];
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

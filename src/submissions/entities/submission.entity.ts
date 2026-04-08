import { Assignment } from 'src/assignments/entities/assignment.entity';
import { SubmitVersion } from 'src/submit-versions/entities/submit-version.entity';
import { User } from 'src/users/entities/user.entity';
import { SubmissionTestResult } from './submission-test-result.entity';
import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	OneToMany,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';

export enum SubmissionLanguage {
	JAVASCRIPT = 'javascript',
	PYTHON = 'python',
}

export enum SubmissionStatus {
	DRAFT = 'draft',
	SUBMITTED = 'submitted',
	GRADED = 'graded',
}

export enum ProcessingStatus {
	PENDING = 'pending',
	PROCESSING = 'processing',
	COMPLETED = 'completed',
	FAILED = 'failed',
}

@Entity('submissions')
export class Submission {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => User, (user) => user.submissions)
	student: User;

	@ManyToOne(() => Assignment, (assignment) => assignment.submissions)
	assignment: Assignment;

	@Column({ type: 'text' })
	code: string;

	@Column({ nullable: true })
	file?: string;

	@Column({
		type: 'enum',
		enum: SubmissionLanguage,
	})
	language: SubmissionLanguage;

	@Column({ type: 'int', nullable: true })
	score?: number;

	@Column({ type: 'int', default: 0 })
	versionCount: number;

	@Column({ type: 'timestamp', nullable: true })
	lastSubmittedAt?: Date;

	@Column({ type: 'float', nullable: true })
	highestSimilarity?: number;

	@Column({ default: false })
	plagiarismFlag: boolean;

	@Column({
		type: 'enum',
		enum: ProcessingStatus,
		default: ProcessingStatus.PENDING,
	})
	judgeStatus: ProcessingStatus;

	@Column({
		type: 'enum',
		enum: ProcessingStatus,
		default: ProcessingStatus.PENDING,
	})
	plagiarismStatus: ProcessingStatus;

	@Column({ type: 'float', default: 0 })
	passRate: number;

	@Column({
		type: 'enum',
		enum: SubmissionStatus,
		default: SubmissionStatus.DRAFT,
	})
	status: SubmissionStatus;

	@OneToMany(() => SubmitVersion, (sv) => sv.submission)
	versions: SubmitVersion[];

	@OneToMany(() => SubmissionTestResult, (result) => result.submission)
	testResults: SubmissionTestResult[];

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}

import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
	OneToOne,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import { AssignmentDocument } from './assignment-document.entity';
import { AssignmentTestCase } from './assignment-test-case.entity';
import { Chapter } from 'src/courses/entities/chapter.entity';

export enum AssignmentStatus {
	DRAFT = 'draft',
	OPEN = 'open',
	CLOSED = 'closed',
}

@Entity('assignments')
export class Assignment {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => User, (user) => user.assignments)
	teacher: User;

	@OneToOne(() => Chapter, (chapter) => chapter.assignment, { nullable: true })
	chapter?: Chapter;

	@Column()
	title: string;

	@Column({ type: 'text' })
	description: string;

	@Column({ nullable: true })
	document: string;

	@Column({ type: 'timestamp' })
	deadline: Date;

	@Column({ type: 'int', default: 100 })
	maxScore: number;

	@Column({ type: 'text', nullable: true })
	evaluationCriteria: string;

	@Column({ default: false })
	allowLateSubmission: boolean;

	@Column({
		type: 'enum',
		enum: AssignmentStatus,
		default: AssignmentStatus.DRAFT,
	})
	status: AssignmentStatus;

	@OneToMany(() => Submission, (submission) => submission.assignment)
	submissions: Submission[];

	@OneToMany(() => AssignmentDocument, (document) => document.assignment)
	documents: AssignmentDocument[];

	@OneToMany(() => AssignmentTestCase, (testCase) => testCase.assignment)
	testCases: AssignmentTestCase[];

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}

import { Assignment } from 'src/assignments/entities/assignment.entity';
import { CourseMember } from 'src/courses/entities/course-member.entity';
import { Course } from 'src/courses/entities/course.entity';
import { Submission } from 'src/submissions/entities/submission.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column({ default: true })
  status: boolean;

  @OneToMany(() => Assignment, (assignment) => assignment.teacher)
  assignments: Assignment[];

  @OneToMany(() => Course, (course) => course.teacher)
  teachingCourses: Course[];

  @OneToMany(() => Submission, (submission) => submission.student)
  submissions: Submission[];

  @OneToMany(() => CourseMember, (member) => member.student)
  courseMemberships: CourseMember[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

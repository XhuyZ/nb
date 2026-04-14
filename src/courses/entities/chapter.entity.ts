import { Assignment } from 'src/assignments/entities/assignment.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';

@Entity('chapters')
export class Chapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, (course) => course.chapters)
  course: Course;

  @Column()
  title: string;

  @Column({ type: 'int', default: 1 })
  orderIndex: number;

  @OneToOne(() => Assignment, (assignment) => assignment.chapter, {
    nullable: true,
  })
  @JoinColumn()
  assignment?: Assignment;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

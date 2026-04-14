import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto';
import { Course } from './entities/course.entity';
import { CourseMember } from './entities/course-member.entity';
import { Chapter } from './entities/chapter.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(CourseMember)
    private readonly courseMembersRepository: Repository<CourseMember>,
    @InjectRepository(Chapter)
    private readonly chaptersRepository: Repository<Chapter>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createCourse(teacherId: string, dto: CreateCourseDto) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId, role: UserRole.TEACHER },
    });
    if (!teacher) {
      throw new ForbiddenException('Only teacher can create course');
    }

    const course = this.coursesRepository.create({
      teacher,
      name: dto.name,
      description: dto.description,
      isPublished: true,
    });
    const saved = await this.coursesRepository.save(course);
    return this.mapCourse(saved);
  }

  async listCourses(filterTeacherId?: string) {
    const where = filterTeacherId
      ? { teacher: { id: filterTeacherId } }
      : undefined;
    const courses = await this.coursesRepository.find({
      where,
      relations: {
        teacher: true,
        chapters: {
          assignment: true,
        },
      },
      order: { created_at: 'DESC' },
    });
    return courses.map((course) => this.mapCourse(course));
  }

  async getCourseById(courseId: string) {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      relations: {
        teacher: true,
        chapters: {
          assignment: true,
        },
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return this.mapCourse(course);
  }

  async enrollCourse(courseId: string, studentId: string) {
    const student = await this.usersRepository.findOne({
      where: { id: studentId, role: UserRole.STUDENT },
    });
    if (!student) {
      throw new ForbiddenException('Only student can join course');
    }
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existed = await this.courseMembersRepository.findOne({
      where: { course: { id: courseId }, student: { id: studentId } },
    });
    if (existed) {
      existed.active = true;
      await this.courseMembersRepository.save(existed);
      return existed;
    }

    const member = this.courseMembersRepository.create({
      course,
      student,
      active: true,
    });
    return this.courseMembersRepository.save(member);
  }

  async listEnrolledCourses(studentId: string) {
    const members = await this.courseMembersRepository.find({
      where: { student: { id: studentId }, active: true },
      relations: {
        course: {
          teacher: true,
          chapters: {
            assignment: true,
          },
        },
      },
    });
    return members.map((member) => this.mapCourse(member.course));
  }

  async listTeachingCourses(teacherId: string) {
    return this.listCourses(teacherId);
  }

  async createChapter(courseId: string, teacherId: string, dto: CreateChapterDto) {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      relations: {
        teacher: true,
        chapters: true,
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.teacher?.id !== teacherId) {
      throw new ForbiddenException('Cannot manage chapter of other teacher course');
    }

    const chapter = this.chaptersRepository.create({
      course,
      title: dto.title,
      orderIndex: (course.chapters?.length ?? 0) + 1,
    });
    return this.chaptersRepository.save(chapter);
  }

  async listChapters(courseId: string) {
    return this.chaptersRepository.find({
      where: { course: { id: courseId } },
      relations: {
        assignment: true,
      },
      order: { orderIndex: 'ASC' },
    });
  }

  private mapCourse(course: Course) {
    return {
      id: course.id,
      name: course.name,
      description: course.description,
      isPublished: course.isPublished,
      teacher: course.teacher
        ? {
            id: course.teacher.id,
            username: course.teacher.username,
          }
        : null,
      chapters: (course.chapters ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          orderIndex: chapter.orderIndex,
          assignmentId: chapter.assignment?.id ?? null,
        })),
      created_at: course.created_at,
      updated_at: course.updated_at,
    };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByUsername(username: string) {
    return this.usersRepository.findOne({
      where: { username },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const existed = await this.usersRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existed) {
      throw new ConflictException('Username already exists');
    }

    const user = this.usersRepository.create({
      username: createUserDto.username,
      password: createUserDto.password,
      role: createUserDto.role ?? UserRole.STUDENT,
      status: createUserDto.status ?? true,
    });
    const saved = await this.usersRepository.save(user);
    return this.sanitizeUser(saved);
  }

  async findAll() {
    const users = await this.usersRepository.find({
      order: { created_at: 'DESC' },
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneForAdmin(id: string) {
    const user = await this.findOne(id);
    return this.sanitizeUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    const updated = await this.usersRepository.save(user);
    return this.sanitizeUser(updated);
  }

  async updateStatus(id: string, updateUserStatusDto: UpdateUserStatusDto) {
    const user = await this.findOne(id);
    user.status = updateUserStatusDto.status;
    const updated = await this.usersRepository.save(user);
    return this.sanitizeUser(updated);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    return { id };
  }

  private sanitizeUser(user: User) {
    const { password: _password, ...rest } = user;
    return rest;
  }
}

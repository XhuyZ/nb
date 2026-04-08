import { Injectable } from '@nestjs/common';
import { CreatePlagiarismDto } from './dto/create-plagiarism.dto';
import { UpdatePlagiarismDto } from './dto/update-plagiarism.dto';

@Injectable()
export class PlagiarismsService {
  create(createPlagiarismDto: CreatePlagiarismDto) {
    return 'This action adds a new plagiarism';
  }

  findAll() {
    return `This action returns all plagiarisms`;
  }

  findOne(id: number) {
    return `This action returns a #${id} plagiarism`;
  }

  update(id: number, updatePlagiarismDto: UpdatePlagiarismDto) {
    return `This action updates a #${id} plagiarism`;
  }

  remove(id: number) {
    return `This action removes a #${id} plagiarism`;
  }
}

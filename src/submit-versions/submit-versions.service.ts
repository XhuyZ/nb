import { Injectable } from '@nestjs/common';
import { CreateSubmitVersionDto } from './dto/create-submit-version.dto';
import { UpdateSubmitVersionDto } from './dto/update-submit-version.dto';

@Injectable()
export class SubmitVersionsService {
  create(createSubmitVersionDto: CreateSubmitVersionDto) {
    return 'This action adds a new submitVersion';
  }

  findAll() {
    return `This action returns all submitVersions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} submitVersion`;
  }

  update(id: number, updateSubmitVersionDto: UpdateSubmitVersionDto) {
    return `This action updates a #${id} submitVersion`;
  }

  remove(id: number) {
    return `This action removes a #${id} submitVersion`;
  }
}

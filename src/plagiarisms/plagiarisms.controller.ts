import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PlagiarismsService } from './plagiarisms.service';
import { CreatePlagiarismDto } from './dto/create-plagiarism.dto';
import { UpdatePlagiarismDto } from './dto/update-plagiarism.dto';

@Controller('plagiarisms')
export class PlagiarismsController {
  constructor(private readonly plagiarismsService: PlagiarismsService) {}

  @Post()
  create(@Body() createPlagiarismDto: CreatePlagiarismDto) {
    return this.plagiarismsService.create(createPlagiarismDto);
  }

  @Get()
  findAll() {
    return this.plagiarismsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plagiarismsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePlagiarismDto: UpdatePlagiarismDto) {
    return this.plagiarismsService.update(+id, updatePlagiarismDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plagiarismsService.remove(+id);
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SubmitVersionsService } from './submit-versions.service';
import { CreateSubmitVersionDto } from './dto/create-submit-version.dto';
import { UpdateSubmitVersionDto } from './dto/update-submit-version.dto';

@Controller('submit-versions')
export class SubmitVersionsController {
  constructor(private readonly submitVersionsService: SubmitVersionsService) {}

  @Post()
  create(@Body() createSubmitVersionDto: CreateSubmitVersionDto) {
    return this.submitVersionsService.create(createSubmitVersionDto);
  }

  @Get()
  findAll() {
    return this.submitVersionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submitVersionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSubmitVersionDto: UpdateSubmitVersionDto) {
    return this.submitVersionsService.update(+id, updateSubmitVersionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.submitVersionsService.remove(+id);
  }
}

import { Module } from '@nestjs/common';
import { SubmitVersionsService } from './submit-versions.service';
import { SubmitVersionsController } from './submit-versions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmitVersion } from './entities/submit-version.entity';

@Module({
	imports: [TypeOrmModule.forFeature([SubmitVersion])],
	controllers: [SubmitVersionsController],
	providers: [SubmitVersionsService],
	exports: [TypeOrmModule],
})
export class SubmitVersionsModule { }

import { typeOrmConfig } from './typeorm.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SubmitVersionsModule } from './submit-versions/submit-versions.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { PlagiarismsModule } from './plagiarisms/plagiarisms.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CoursesModule } from './courses/courses.module';
import { StatisticsReportingModule } from './statistics-reporting/statistics-reporting.module';
import { ReviewVerdictModule } from './review-verdict/review-verdict.module';
import { EvidenceChainModule } from './evidence-chain/evidence-chain.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmConfig),
    UsersModule,
    SubmissionsModule,
    SubmitVersionsModule,
    AssignmentsModule,
    PlagiarismsModule,
    AuthModule,
    SeedModule,
    CoursesModule,
    StatisticsReportingModule,
    ReviewVerdictModule,
    EvidenceChainModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtAuthGuard, RolesGuard],
})
export class AppModule {}

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { EvidenceChainService } from './evidence-chain.service';

@ApiTags('evidence-chain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evidence-chain')
export class EvidenceChainController {
  constructor(private readonly evidenceService: EvidenceChainService) {}

  @Get(':submissionId')
  @ApiOperation({ summary: 'Sinh chuoi bang chung nghi van dao code' })
  getEvidence(
    @Param('submissionId') submissionId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.evidenceService.getEvidenceChain(
      submissionId,
      req.user.sub,
      req.user.role,
    );
  }
}

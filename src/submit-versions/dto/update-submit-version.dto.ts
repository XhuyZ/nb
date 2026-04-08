import { PartialType } from '@nestjs/swagger';
import { CreateSubmitVersionDto } from './create-submit-version.dto';

export class UpdateSubmitVersionDto extends PartialType(CreateSubmitVersionDto) {}

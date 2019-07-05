import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';

@ApiUseTags('core')
@Controller()
export class AdminController {}

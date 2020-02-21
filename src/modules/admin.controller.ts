import { Controller, Get } from '@nestjs/common';

@Controller('admin/v1')
export class AdminController {
  static stateMachines: { [key: string]: object } = {};

  @Get('state-machines')
  stateMachines() {
    return AdminController.stateMachines;
  }
}

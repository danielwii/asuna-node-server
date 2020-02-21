import { Controller, Get } from '@nestjs/common';

@Controller('admin/v1')
export class AdminController {
  // TODO using state-machine helper later
  static stateMachines: { [key: string]: object } = {};

  @Get('state-machines')
  stateMachines() {
    return AdminController.stateMachines;
  }
}

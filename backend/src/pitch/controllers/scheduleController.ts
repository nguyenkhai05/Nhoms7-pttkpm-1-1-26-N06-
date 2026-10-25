import {Controller,Get,Param,Query,Inject} from '@nestjs/common';
import {ScheduleService} from '../services/scheduleService.js';
@Controller('api/pitches')
export class ScheduleController {
 constructor(@Inject(ScheduleService) private readonly service:ScheduleService){}
 @Get(':id/schedule') async matrix(@Param('id') id:string,@Query('date') date:string){return {data:await this.service.matrix(id,date)};}
}

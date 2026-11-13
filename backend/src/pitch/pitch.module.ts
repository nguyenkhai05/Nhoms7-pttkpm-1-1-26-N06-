import {Module} from '@nestjs/common';
import {PitchController} from './controllers/pitchController.js';
import {ScheduleController} from './controllers/scheduleController.js';
import {PitchRepository} from './repositories/pitchRepository.js';
import {PitchService} from './services/pitchService.js';
import {ScheduleService} from './services/scheduleService.js';
import {MysqlDatabase} from '../database/mysqlDatabase.js';
import {DatabaseModule} from '../database/database.module.js';
@Module({imports:[DatabaseModule],controllers:[PitchController,ScheduleController],providers:[
 {provide:PitchRepository,useFactory:(db:MysqlDatabase)=>new PitchRepository(db),inject:[MysqlDatabase]},
 {provide:PitchService,useFactory:(r:PitchRepository)=>new PitchService(r),inject:[PitchRepository]},
 {provide:ScheduleService,useFactory:(p:PitchService,r:PitchRepository)=>new ScheduleService(p,r),inject:[PitchService,PitchRepository]},
],exports:[PitchService,ScheduleService]})
export class PitchModule {}

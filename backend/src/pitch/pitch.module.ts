import {Module} from '@nestjs/common';
import {PitchController} from './controllers/pitchController.js';
import {ScheduleController} from './controllers/scheduleController.js';
import {PitchRepository} from './repositories/pitchRepository.js';
import {PitchService} from './services/pitchService.js';
import {ScheduleService} from './services/scheduleService.js';
import {HoldStore} from './infrastructure/holdStore.js';
import {createDatabase,seed} from './infrastructure/database.js';
export const PITCH_DATABASE=Symbol('PITCH_DATABASE');
@Module({controllers:[PitchController,ScheduleController],providers:[
 {provide:PITCH_DATABASE,useFactory:()=>{const db=createDatabase(process.env.DB_PATH||'pitch.sqlite');seed(db,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()));return db;}},
 {provide:HoldStore,useFactory:()=>{const holds=new HoldStore();holds.hold(1,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()),4);return holds;}},
 {provide:PitchRepository,useFactory:(db:ReturnType<typeof createDatabase>)=>new PitchRepository(db),inject:[PITCH_DATABASE]},
 {provide:PitchService,useFactory:(r:PitchRepository)=>new PitchService(r),inject:[PitchRepository]},
 {provide:ScheduleService,useFactory:(p:PitchService,r:PitchRepository,h:HoldStore)=>new ScheduleService(p,r,h),inject:[PitchService,PitchRepository,HoldStore]},
],exports:[PitchService,ScheduleService]})
export class PitchModule {}

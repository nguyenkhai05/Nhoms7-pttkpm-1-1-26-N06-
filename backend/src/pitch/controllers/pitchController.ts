import {Controller,Get,Param,Query,Inject} from '@nestjs/common';
import {PitchService} from '../services/pitchService.js';
import type {SearchQuery} from '../types.js';
@Controller('api/pitches')
export class PitchController {
 constructor(@Inject(PitchService) private readonly service:PitchService){}
 @Get() search(@Query() query:SearchQuery){return {data:this.service.search(query)};}
 @Get(':id') detail(@Param('id') id:string){return {data:this.service.detail(id)};}
}

import {Controller,Get,Param,Query,Inject} from '@nestjs/common';
import {PitchService} from '../services/pitchService.js';
import type {SearchQuery} from '../types.js';
@Controller('api/pitches')
export class PitchController {
 constructor(@Inject(PitchService) private readonly service:PitchService){}
 @Get() async search(@Query() query:SearchQuery){return {data:await this.service.search(query)};}
 @Get(':id') async detail(@Param('id') id:string){return {data:await this.service.detail(id)};}
}

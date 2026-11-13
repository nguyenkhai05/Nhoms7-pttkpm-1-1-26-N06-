import {describe,it,expect} from 'vitest';
import {positiveId} from './services/pitchService.js';
import {validateDate} from './services/scheduleService.js';
describe('UC12 input validation',()=>{
 it('validates ids',()=>{expect(positiveId('1')).toBe(1);for(const id of ['0','-1','x','1 OR 1=1'])expect(()=>positiveId(id)).toThrow();});
 it('validates calendar dates',()=>{expect(validateDate('2026-10-25')).toBe('2026-10-25');for(const d of ['x','2026-02-30','2026-13-01'])expect(()=>validateDate(d)).toThrow();});
});

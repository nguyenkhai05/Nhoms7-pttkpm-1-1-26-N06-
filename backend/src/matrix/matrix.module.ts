import { Module } from '@nestjs/common';
import { MatrixController } from './matrix.controller.js';
import { MatrixService } from './matrix.service.js';
import { MatrixRepository } from './matrix.repository.js';

@Module({
  controllers: [MatrixController],
  providers: [MatrixService, MatrixRepository],
  exports: [MatrixService],
})
export class MatrixModule {}
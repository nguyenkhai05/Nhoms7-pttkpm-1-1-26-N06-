import { describe, expect, it } from 'vitest';
import { calculateRefundPolicy } from './operations.service.js';

describe('cancellation deposit policy', () => {
  it('refunds 100 percent at exactly 24 hours', () => {
    expect(calculateRefundPolicy(24, 300000)).toEqual({ refundPercent: 100, refundAmount: 300000, flow: 'AUTO' });
  });
  it('uses the 50 percent tier one second before 24 hours', () => {
    expect(calculateRefundPolicy(24 - 1 / 3600, 300000)).toEqual({ refundPercent: 50, refundAmount: 150000, flow: 'NEED_APPROVAL' });
  });
  it('refunds 50 percent at exactly 12 hours', () => {
    expect(calculateRefundPolicy(12, 300000)).toEqual({ refundPercent: 50, refundAmount: 150000, flow: 'NEED_APPROVAL' });
  });
  it('does not refund one second before the 12 hour boundary', () => {
    expect(calculateRefundPolicy(12 - 1 / 3600, 300000)).toEqual({ refundPercent: 0, refundAmount: 0, flow: 'NO_REFUND' });
  });
  it('does not refund below 12 hours', () => {
    expect(calculateRefundPolicy(11.99, 300000)).toEqual({ refundPercent: 0, refundAmount: 0, flow: 'NO_REFUND' });
  });
  it('rounds a half refund down to whole VND', () => {
    expect(calculateRefundPolicy(12, 101)).toEqual({ refundPercent: 50, refundAmount: 50, flow: 'NEED_APPROVAL' });
  });
});

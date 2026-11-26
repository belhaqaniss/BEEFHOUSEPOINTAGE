import test from 'node:test';
import assert from 'node:assert/strict';
import {closingLimit,countedDeparture,countedShiftMilliseconds as duration} from './closing-hours.js';
import {buildEmployeeMonthReport,buildEmployeeRangeReport} from './employee-hours.js';
test('October unchanged, November weekdays midnight and Saturdays 01:00',()=>{
  assert.equal(duration('2026-10-31T20:00:00+01:00','2026-11-01T02:30:00+01:00','2026-10-31'),390*60000);
  assert.equal(duration('2026-11-01T20:00:00+01:00','2026-11-02T02:30:00+01:00','2026-11-01'),240*60000);
  assert.equal(duration('2026-11-07T20:00:00+01:00','2026-11-08T02:30:00+01:00','2026-11-07'),300*60000);
  assert.equal(duration('2026-11-08T20:00:00+01:00','2026-11-08T23:30:00+01:00','2026-11-08'),210*60000);
});
test('real daylight saving offsets at 01:00 and no negative or open durations',()=>{
  assert.equal(new Date(closingLimit('2027-03-27')).toISOString(),'2027-03-28T00:00:00.000Z');
  assert.equal(new Date(closingLimit('2027-07-03')).toISOString(),'2027-07-03T23:00:00.000Z');
  assert.equal(duration('2026-11-02T00:15:00+01:00','2026-11-02T01:00:00+01:00','2026-11-01'),0);
  assert.equal(duration('2026-11-01T12:00:00Z','2026-11-01T11:00:00Z','2026-11-01'),0);
});
test('monthly and range totals agree; original departures preserved',()=>{
  const events=[{id:1,type:'Arrivée',timestamp:'2026-11-07T20:00:00+01:00',workDate:'2026-11-07'},{id:2,type:'Départ',timestamp:'2026-11-08T02:30:00+01:00',workDate:'2026-11-07'}];
  const original=JSON.stringify(events),month=buildEmployeeMonthReport(events,'2026-11','2026-11-30');
  assert.equal(month.totalMinutes,300);assert.equal(month.eveningMinutes,300);assert.equal(month.days[6].minutes,300);
  assert.equal(month.days[6].shifts[0].end,events[1].timestamp);
  assert.equal(buildEmployeeRangeReport(events,'2026-11-01','2026-11-30').totalMinutes,300);
  assert.equal(JSON.stringify(events),original);
});
test('departure display is capped in Paris while retaining the original value',()=>{
  const original='2026-11-27T02:30:00+01:00';
  assert.equal(countedDeparture(original,'2026-11-26'),'2026-11-26T23:00:00.000Z');
  assert.equal(countedDeparture('2026-11-29T02:00:00+01:00','2026-11-28'),'2026-11-29T00:00:00.000Z');
  assert.equal(countedDeparture('2026-11-01T02:30:00+01:00','2026-10-31'),'2026-11-01T01:30:00.000Z');
  assert.equal(countedDeparture('2026-11-26T22:00:00+01:00','2026-11-26'),'2026-11-26T21:00:00.000Z');
  assert.equal(original,'2026-11-27T02:30:00+01:00');
});

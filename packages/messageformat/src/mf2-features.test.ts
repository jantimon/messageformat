// @ts-ignore
import { source } from 'common-tags';
import { compileFluent, compileMF1 } from '@messageformat/compiler';

import {
  fluentRuntime,
  FunctionOptions,
  MessageFormat,
  Resource,
  Runtime
} from './index';

test('Dynamic References (unicode-org/message-format-wg#130)', () => {
  const res: Resource = {
    id: 'res',
    locale: 'fi',
    entries: {
      browser: {
        entries: {
          chrome: {
            entries: {
              nominative: { value: ['Chrome'] },
              genitive: { value: ['Chromen'] }
            }
          },
          edge: {
            entries: {
              nominative: { value: ['Edge'] },
              genitive: { value: ['Edgen'] }
            }
          },
          firefox: {
            entries: {
              nominative: { value: ['Firefox'] },
              genitive: { value: ['Firefoxin'] }
            }
          },
          safari: {
            entries: {
              nominative: { value: ['Safari'] },
              genitive: { value: ['Safarin'] }
            }
          }
        }
      },
      settings: {
        value: [
          { msg_path: ['browser', { var_path: ['browser-id'] }, 'genitive'] },
          ' asetukset'
        ]
      }
    }
  };
  const mf = new MessageFormat('fi', null, res);

  const msg = mf.format('res', ['settings'], { 'browser-id': 'firefox' });
  expect(msg).toBe('Firefoxin asetukset');

  const parts = mf.formatToParts('res', ['settings'], {
    'browser-id': 'firefox'
  });
  expect(parts).toMatchObject([
    { type: 'message', value: [{ type: 'literal', value: 'Firefoxin' }] },
    { type: 'literal', value: ' asetukset' }
  ]);
});

describe('Plural Range Selectors & Range Formatters (unicode-org/message-format-wg#125)', () => {
  function parseRangeArgs(
    start: number | { start: number; end: number },
    end: number | undefined
  ) {
    if (typeof end === 'number') {
      if (typeof start !== 'number')
        throw new Error(`Invalid arguments (${start}, ${end})`);
      return { start, end };
    } else {
      if (!start || typeof start !== 'object')
        throw new Error(`Invalid arguments (${start}, ${end})`);
      return { start: start.start, end: start.end };
    }
  }
  function formatRange(
    _locales: string[],
    _options: FunctionOptions,
    start: number | { start: number; end: number },
    end?: number
  ) {
    const range = parseRangeArgs(start, end);
    return `${range.start} - ${range.end}`;
  }
  function pluralRange(
    locales: string[],
    options: FunctionOptions,
    start: number | { start: number; end: number },
    end?: number
  ) {
    if (locales[0] !== 'nl') throw new Error('Only Dutch supported');
    const range = parseRangeArgs(start, end);
    const pr = new Intl.PluralRules(locales, options);
    return pr.select(range.end);
  }
  const runtime: Runtime = { select: { pluralRange }, format: { formatRange } };

  test('input as { start, end } object', () => {
    const res: Resource = {
      id: 'res',
      locale: 'nl',
      entries: {
        msg: {
          value: {
            select: [
              {
                value: { func: 'pluralRange', args: [{ var_path: ['range'] }] }
              }
            ],
            cases: [
              {
                key: ['one'],
                value: [
                  { func: 'formatRange', args: [{ var_path: ['range'] }] },
                  ' dag'
                ]
              },
              {
                key: ['other'],
                value: [
                  { func: 'formatRange', args: [{ var_path: ['range'] }] },
                  ' dagen'
                ]
              }
            ]
          }
        }
      }
    };
    const mf = new MessageFormat('nl', runtime, res);

    const msg1 = mf.format('res', ['msg'], { range: { start: 0, end: 1 } });
    expect(msg1).toBe('0 - 1 dag');

    const msg2 = mf.format('res', ['msg'], { range: { start: 1, end: 2 } });
    expect(msg2).toBe('1 - 2 dagen');
  });

  test('input as separate start, end falues', () => {
    const res: Resource = {
      id: 'res',
      locale: 'nl',
      entries: {
        msg: {
          value: {
            select: [
              {
                value: {
                  func: 'pluralRange',
                  args: [{ var_path: ['start'] }, { var_path: ['end'] }]
                }
              }
            ],
            cases: [
              {
                key: ['one'],
                value: [
                  {
                    func: 'formatRange',
                    args: [{ var_path: ['start'] }, { var_path: ['end'] }]
                  },
                  ' dag'
                ]
              },
              {
                key: ['other'],
                value: [
                  {
                    func: 'formatRange',
                    args: [{ var_path: ['start'] }, { var_path: ['end'] }]
                  },
                  ' dagen'
                ]
              }
            ]
          }
        }
      }
    };
    const mf = new MessageFormat('nl', runtime, res);

    const msg1 = mf.format('res', ['msg'], { start: 0, end: 1 });
    expect(msg1).toBe('0 - 1 dag');

    const msg2 = mf.format('res', ['msg'], { start: 1, end: 2 });
    expect(msg2).toBe('1 - 2 dagen');
  });
});

describe('Multi-selector messages (unicode-org/message-format-wg#119)', () => {
  test('All-inclusive resort (@nbouvrette)', () => {
    const src = source`
      This all-inclusive resort includes {poolCount, plural,
        =0 {no pools} one {# pool} other {# pools}
      }, {restaurantCount, plural,
        =0 {no restaurants} one {# restaurant} other {# restaurants}
      }, {beachCount, plural,
        =0 {no beaches} one {# beach} other {# beaches}
      } and {golfCount, plural,
        =0 {no golf courses} one {# golf course} other {# golf courses}
      }.`;
    const res = compileMF1({ msg: src }, { id: 'res', locale: 'en' });
    expect((res.entries.msg as any).value.select).toHaveLength(4);
    expect((res.entries.msg as any).value.cases).toHaveLength(81);

    const mf = new MessageFormat('en', null, res);

    const none = mf.format('res', ['msg'], {
      poolCount: 0,
      restaurantCount: 0,
      beachCount: 0,
      golfCount: 0
    });
    expect(none).toBe(
      'This all-inclusive resort includes no pools, no restaurants, no beaches and no golf courses.'
    );

    const one = mf.format('res', ['msg'], {
      poolCount: 1,
      restaurantCount: 1,
      beachCount: 1,
      golfCount: 1
    });
    expect(one).toBe(
      'This all-inclusive resort includes 1 pool, 1 restaurant, 1 beach and 1 golf course.'
    );

    const two = mf.format('res', ['msg'], {
      poolCount: 2,
      restaurantCount: 2,
      beachCount: 2,
      golfCount: 2
    });
    expect(two).toBe(
      'This all-inclusive resort includes 2 pools, 2 restaurants, 2 beaches and 2 golf courses.'
    );
  });

  test('Item list (@eemeli)', () => {
    const src = source`
      Listing
      {N, plural, one{one} other{#}}
      {LIVE, select, undefined{} other{current and future}}
      {TAG}
      {N, plural, one{item} other{items}}
      {DAY, select, undefined{} other{on {DAY} {TIME, select, undefined{} other{after {TIME}}}}}
      {AREA, select, undefined{} other{in {AREA}}}
      {Q, select, undefined{} other{matching the query {Q}}}
    `;
    const res = compileMF1({ msg: src }, { id: 'res', locale: 'en' });
    expect((res.entries.msg as any).value.select).toHaveLength(6);
    expect((res.entries.msg as any).value.cases).toHaveLength(64);

    const mf = new MessageFormat('en', null, res);

    const one = mf.format('res', ['msg'], {
      N: 1,
      LIVE: String(undefined),
      TAG: 'foo',
      DAY: String(undefined),
      AREA: String(undefined),
      Q: String(undefined)
    });
    expect(one.replace(/\s+/g, ' ').trim()).toBe('Listing one foo item');

    const two = mf.format('res', ['msg'], {
      N: 2,
      LIVE: true,
      TAG: 'foo',
      DAY: String(undefined),
      AREA: 'there',
      Q: '"bar"'
    });
    expect(two.replace(/\s+/g, ' ').trim()).toBe(
      'Listing 2 current and future foo items in there matching the query "bar"'
    );
  });

  test('Mozilla activity (@stasm)', () => {
    const src = source`
      activity-needed-calculation-plural = { NUMBER($totalHours) ->
          [one] {$totalHours} hour
        *[other] {$totalHours} hours
      } is achievable in just over { NUMBER($periodMonths) ->
          [one] {$periodMonths} month
        *[other] {$periodMonths} months
      } if { NUMBER($people) ->
          [one] {$people} person
        *[other] {$people} people
      } record { NUMBER($clipsPerDay) ->
          [one] {$clipsPerDay} clip
        *[other] {$clipsPerDay} clips
      } a day.
    `;
    const res = compileFluent(src, { id: 'res', locale: 'en' });
    const mf = new MessageFormat('en', fluentRuntime, res);

    const msg: any = mf.getEntry('res', ['activity-needed-calculation-plural']);
    expect(msg.value.select).toHaveLength(4);
    expect(msg.value.cases).toHaveLength(16);

    const one = mf.format('res', ['activity-needed-calculation-plural'], {
      totalHours: 1,
      periodMonths: 1,
      people: 1,
      clipsPerDay: 1
    });
    expect(one).toBe(
      '1 hour is achievable in just over 1 month if 1 person record 1 clip a day.'
    );

    const two = mf.format('res', ['activity-needed-calculation-plural'], {
      totalHours: 2,
      periodMonths: 2,
      people: 2,
      clipsPerDay: 2
    });
    expect(two).toBe(
      '2 hours is achievable in just over 2 months if 2 people record 2 clips a day.'
    );
  });
});
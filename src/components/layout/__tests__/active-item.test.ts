/**
 * One current page per group. `/opportunities/applications` nests inside
 * `/opportunities`, so prefix matching alone marked both catalogue items as
 * the page you are on.
 */

import { activeItemHref } from '../AdminHeader'

const CATALOGUE = [
  { href: '/opportunities', activeFor: ['/activities'] },
  { href: '/opportunities/applications' },
]

describe('activeItemHref', () => {
  it.each([
    ['/opportunities', '/opportunities'],
    ['/opportunities/abc123', '/opportunities'],
    ['/opportunities/applications', '/opportunities/applications'],
    ['/activities', '/opportunities'],
    ['/residents', null],
  ])('%s → %s', (pathname, expected) => {
    expect(activeItemHref(pathname, CATALOGUE)).toBe(expected)
  })
})

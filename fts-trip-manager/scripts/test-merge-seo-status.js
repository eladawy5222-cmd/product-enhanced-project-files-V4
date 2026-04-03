const { mergeSeoStatusFromImprovementRecords } = require('../src/core/trips-merge')

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    const e = new Error(`${msg}: expected=${String(expected)} actual=${String(actual)}`)
    e.actual = actual
    e.expected = expected
    throw e
  }
}

function main() {
  const trips = [
    { id: 'recTrip1', fields: { Title: 'A' } },
    { id: 'recTrip2', fields: { Title: 'B', AI_SEO_Status: 'Done' } },
    { id: 'recTrip3', fields: { Title: 'C' } }
  ]
  const improvements = [
    { id: 'recImp1', fields: { Trip: ['recTrip1'], AI_SEO_Status: 'Pending' } },
    { id: 'recImp2', fields: { Trip: ['recTrip3'], AI_SEO_Status: 'Processing' } }
  ]

  const merged = mergeSeoStatusFromImprovementRecords(trips, improvements)
  assertEq(merged[0].fields.AI_SEO_Status, 'Pending', 'Trip1 merged status')
  assertEq(merged[1].fields.AI_SEO_Status, 'Done', 'Trip2 preserves existing status')
  assertEq(merged[2].fields.AI_SEO_Status, 'Processing', 'Trip3 merged status')
  console.log('ok')
}

main()


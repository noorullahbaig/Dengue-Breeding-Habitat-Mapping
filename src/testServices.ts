import { createMockAppServices } from './mocks/mockServices'
import { isWithinServiceArea } from './lib/serviceArea'
import { seededReports } from './mocks/data'

async function run() {
  console.log('Testing isWithinServiceArea for seededReports:')
  for (const report of seededReports) {
    const isWithin = isWithinServiceArea(report.publicLocation)
    console.log(`- ${report.neighborhood} (${report.publicLocation.latitude}, ${report.publicLocation.longitude}): ${isWithin}`)
  }

  const { mapService } = createMockAppServices()
  
  try {
    const reports = await mapService.listPublicReports()
    console.log(`\nMock listPublicReports returned ${reports.length} reports`)
  } catch (e) {
    console.error('\nMock listPublicReports error:', e)
  }

  try {
    const hotspots = await mapService.listHotspots()
    console.log(`\nMock listHotspots returned ${hotspots.length} hotspots`)
  } catch (e) {
    console.error('\nMock listHotspots error:', e)
  }
}

run()

function createContextUtils(options) {
  const airtable = options.airtable
  const logger = options.logger
  const config = options.config

  const TABLE_LINK_FIELD_MAP = {
    TripHighlights: 'Trip',
    TripFAQs: 'Trip',
    TripDetails: 'Trip',
    Packages: 'Trip',
    PickupLocations: 'Trip',
    ItinerarySteps: 'Trip',
    'Itinerary Improvement With AI': 'Trip',
    TripIncludes: 'Trip',
    'TripIncludes Improvement With AI': 'Trip',
    TripExcludes: 'Trip',
    'TripExcludes Improvement With AI': 'Trip',
    AddOns: 'Trip',
    'AddOns Improvement With AI': 'Trip',
    'FAQs Improvement With AI': 'Trip',
    'Trip Facts Improvement With AI': 'Trip',
    'Images Improvement With AI': 'Trip',
    Images: 'SourceTrip'
  }

  const TABLE_TRIPID_FALLBACK_MAP = {}

  async function fetchRecordsByTrip(tableName, tripId, tripNumber, pageSize, tripName) {
    const linkField = TABLE_LINK_FIELD_MAP[tableName] || (config.LINK_FIELDS && config.LINK_FIELDS[tableName]) || 'Trip'
    const maxOut = Math.max(1, Number(pageSize || 100))
    const safeId = String(tripId || '').replace(/'/g, "\\'").trim()
    const safeNum = String(tripNumber || '').replace(/'/g, "\\'").trim()
    const safeName = String(tripName || '').replace(/'/g, "\\'").trim()

    const out = []
    try {
      const conditions = []
      if (safeId) conditions.push(`FIND('${safeId}', ARRAYJOIN({${linkField}}))`)
      if (safeNum) conditions.push(`FIND('${safeNum}', ARRAYJOIN({${linkField}}))`)
      if (safeName) conditions.push(`FIND('${safeName}', ARRAYJOIN({${linkField}}))`)
      const tripIdField = TABLE_TRIPID_FALLBACK_MAP[tableName]
      if (tripIdField && safeNum) conditions.push(`{${tripIdField}} = '${safeNum}'`)

      if (conditions.length) {
        const formula = conditions.length === 1 ? conditions[0] : `OR(${conditions.join(', ')})`
        let offset = null
        do {
          const params = { filterByFormula: formula, pageSize: 100 }
          if (offset) params.offset = offset
          const res = await airtable.airtableGet(tableName, params)
          const recs = res && res.records ? res.records : []
          for (const r of recs) {
            out.push(r)
            if (out.length >= maxOut) break
          }
          if (out.length >= maxOut) break
          offset = res && res.offset ? res.offset : null
        } while (offset)
      }

      if (!out.length && safeId) {
        let offset2 = null
        do {
          const params2 = { pageSize: 100 }
          if (offset2) params2.offset = offset2
          const res2 = await airtable.airtableGet(tableName, params2)
          const recs2 = res2 && res2.records ? res2.records : []
          for (const r2 of recs2) {
            const f2 = r2 && r2.fields ? r2.fields : {}
            const links = f2[linkField]
            const hit = Array.isArray(links) ? links.indexOf(safeId) !== -1 : String(links || '') === safeId
            if (!hit) continue
            out.push(r2)
            if (out.length >= maxOut) break
          }
          if (out.length >= maxOut) break
          offset2 = res2 && res2.offset ? res2.offset : null
        } while (offset2)
      }
    } catch (e) {
      logger.warn(`fetchRecordsByTrip Error (${tableName}): ${String(e && e.message ? e.message : e)}`)
      return []
    }

    return out
  }

  function concatFieldsText(records, fieldNames) {
    const out = []
    const recs = records || []
    for (let i = 0; i < recs.length; i++) {
      const f = recs[i].fields || {}
      for (let j = 0; j < fieldNames.length; j++) {
        const v = String(f[fieldNames[j]] || '').trim()
        if (v) out.push(v)
      }
    }
    return out
  }

  function sortByStepOrder(records) {
    const recs = (records || []).slice()
    recs.sort((a, b) => {
      const af = a.fields || {}
      const bf = b.fields || {}
      const ao = typeof af.StepOrder === 'number' ? af.StepOrder : 0
      const bo = typeof bf.StepOrder === 'number' ? bf.StepOrder : 0
      return ao - bo
    })
    return recs
  }

  function formatItineraryStepsWithDetails(records) {
    const out = []
    const recs = records || []
    for (let i = 0; i < recs.length; i++) {
      const f = recs[i].fields || {}
      const title = String(f.StepTitle || '').trim()
      const desc = String(f.StepDescription || '').trim()

      const extras = []
      if (f.Duration) extras.push(`Duration: ${f.Duration}`)
      if (f.Duration_Hours) extras.push(`Hours: ${f.Duration_Hours}`)
      if (f.Duration_Minutes) extras.push(`Minutes: ${f.Duration_Minutes}`)
      if (f.DurationText) extras.push(`DurationText: ${f.DurationText}`)
      if (f.Time) extras.push(`Time: ${f.Time}`)
      if (f.Start_Time || f.StartTime) extras.push(`Start: ${f.Start_Time || f.StartTime}`)
      if (f.End_Time || f.EndTime) extras.push(`End: ${f.End_Time || f.EndTime}`)
      if (f.Day_Number || f.Day) extras.push(`Day: ${f.Day_Number || f.Day}`)

      let line = title
      if (extras.length > 0) line += ` [${extras.join(', ')}]`
      if (desc) line += `${line ? ' - ' : ''}${desc}`
      if (line) out.push(line)
    }
    return out
  }

  async function buildUnifiedTripContext(tripId, tripFields) {
    const tripNumber = tripFields && tripFields.TripID ? String(tripFields.TripID) : ''
    const tripName = tripFields && tripFields.Title ? String(tripFields.Title) : ''

    const rawHighlightsRecs = await fetchRecordsByTrip('TripHighlights', tripId, tripNumber, 100, tripName)
    const rawHighlightsArr = concatFieldsText(rawHighlightsRecs, ['Highlight'])

    const improvedHighlightsRecs = await fetchRecordsByTrip('Highlights Improvement With AI', tripId, tripNumber, 100, tripName)
    const improvedHighlightsArr = concatFieldsText(improvedHighlightsRecs, ['AI_Highlight'])

    const itinRawRecs = await fetchRecordsByTrip('ItinerarySteps', tripId, tripNumber, 100, tripName)
    const itinRawArr = formatItineraryStepsWithDetails(sortByStepOrder(itinRawRecs))

    const itinImpRecs = await fetchRecordsByTrip('Itinerary Improvement With AI', tripId, tripNumber, 100, tripName)
    const itinImpArr = concatFieldsText(sortByStepOrder(itinImpRecs), ['AI_Step_Title', 'AI_Step_Description'])

    const incRawRecs = await fetchRecordsByTrip('TripIncludes', tripId, tripNumber, 100, tripName)
    const incRawArr = concatFieldsText(incRawRecs, ['IncludeItem'])

    const incImpRecs = await fetchRecordsByTrip('TripIncludes Improvement With AI', tripId, tripNumber, 100, tripName)
    const incImpArr = concatFieldsText(incImpRecs, ['AI_IncludeItem', 'AI_IncludeText'])

    const exRawRecs = await fetchRecordsByTrip('TripExcludes', tripId, tripNumber, 100, tripName)
    const exRawArr = concatFieldsText(exRawRecs, ['ExcludeItem'])

    const exImpRecs = await fetchRecordsByTrip('TripExcludes Improvement With AI', tripId, tripNumber, 100, tripName)
    const exImpArr = concatFieldsText(exImpRecs, ['AI_ExcludeItem', 'AI_ExcludeText'])

    const addRawRecs = await fetchRecordsByTrip('AddOns', tripId, tripNumber, 100, tripName)
    const addRawArr = concatFieldsText(addRawRecs, ['AddOnTitle', 'AddOnDescription'])

    const addImpRecs = await fetchRecordsByTrip('AddOns Improvement With AI', tripId, tripNumber, 100, tripName)
    const addImpArr = concatFieldsText(addImpRecs, ['AI_AddOn_Title', 'AI_AddOn_Description'])

    const faqRawRecs = await fetchRecordsByTrip('TripFAQs', tripId, tripNumber, 100, tripName)
    const faqRawArr = concatFieldsText(faqRawRecs, ['Question', 'Answer'])

    const faqImpRecs = await fetchRecordsByTrip('FAQs Improvement With AI', tripId, tripNumber, 100, tripName)
    const faqImpArr = concatFieldsText(faqImpRecs, ['AI_Question', 'AI_Answer'])

    const pickupRecs = await fetchRecordsByTrip('PickupLocations', tripId, tripNumber, 100, tripName)
    const pickupArr = concatFieldsText(pickupRecs, ['LocationName', 'LocationNotes'])

    const packagesRecs = await fetchRecordsByTrip('Packages', tripId, tripNumber, 100, tripName)
    const packagesArr = concatFieldsText(packagesRecs, ['PackageName', 'ShortDescription'])

    const detailsRecs = await fetchRecordsByTrip('TripDetails', tripId, tripNumber, 100, tripName)
    const detailsArr = concatFieldsText(detailsRecs, ['DetailTitle', 'DetailText'])

    return {
      rawHighlightsArr,
      improvedHighlightsArr,
      highlightsText: rawHighlightsArr.concat(improvedHighlightsArr).join('\n'),
      itineraryArr: itinRawArr.concat(itinImpArr),
      itineraryText: '=== RAW ITINERARY STEPS (Use for Duration Calculation) ===\n' + itinRawArr.join('\n'),
      includesArr: incRawArr.concat(incImpArr),
      includesRawArr: incRawArr,
      includesText: incRawArr.concat(incImpArr).join('\n'),
      excludesArr: exRawArr.concat(exImpArr),
      excludesRawArr: exRawArr,
      excludesText: exRawArr.concat(exImpArr).join('\n'),
      addonsArr: addRawArr.concat(addImpArr),
      addonsText: addRawArr.concat(addImpArr).join('\n'),
      pickupArr,
      pickupText: pickupArr.join('\n'),
      packagesArr,
      packagesText: packagesArr.join('\n'),
      detailsArr,
      detailsText: detailsArr.join('\n'),
      faqsArr: faqRawArr.concat(faqImpArr),
      faqsText: faqRawArr.concat(faqImpArr).join('\n')
    }
  }

  return { buildUnifiedTripContext }
}

module.exports = { createContextUtils }

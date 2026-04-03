const { sleep } = require('../core/runtime')
const { createImprovementRepository } = require('./enhancement-helpers')

let airtable
let http
let config
let logger
let lock
let store
let aiProvider

let ImprovementRepository

function initOrchestrator(options) {
  if (!options) throw new Error('createOrchestrator: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider

  if (!airtable) throw new Error('createOrchestrator: missing options.airtable')
  if (!http) throw new Error('createOrchestrator: missing options.http')
  if (!config) throw new Error('createOrchestrator: missing options.config')
  if (!logger) throw new Error('createOrchestrator: missing options.logger')
  if (!store) throw new Error('createOrchestrator: missing options.store')

  if (!lock) {
    lock = {
      async tryLock() {
        return true
      },
      releaseLock() {
      }
    }
  }

  ImprovementRepository = createImprovementRepository({ airtable, http })
}

function loadConfigSecrets_() {
}

function log(msg) {
  logger.info(String(msg == null ? '' : msg))
}

async function airtableGet_(tableName, params) {
  return airtable.airtableGet(tableName, params || {})
}

async function airtableUpdate_(tableName, recordId, fields) {
  return airtable.airtableUpdate(tableName, recordId, fields || {})
}

async function updateEnhancementStatus_(tripId, fieldName, status) {
  const fields = {}
  fields[String(fieldName)] = status
  await airtableUpdate_('Trips', tripId, fields)
}

/**
 * ENHANCEMENT ORCHESTRATOR
 * 
 * Manages the sequential enhancement pipeline for trips imported from WordPress.
 * Coordinates 9 stages of AI enhancement, ensuring each stage completes before
 * the next one begins.
 * 
 * Pipeline Stages:
 * 1. ai_enhancer (Base Content)
 * 2. ai_addons_enhancer (Add-ons)
 * 3.1. ai_highlights (Highlights)
 * 3.2. ai_itinerary_enhancer (Itinerary)
 * 3.3. ai_includes_excludes (Includes/Excludes)
 * 3.4. ai_trip_facts (Trip Facts)
 * 3.5. ai_faqs_enhancer (FAQs)
 * 3.6. ai_seo_enhancer (SEO)
 * 3.7. ai_images_enhancer (Images)
 */

/**
 * Initialize enhancement pipeline for a newly imported trip
 * Called from wp_fetch.gs after upsertTrip_()
 * 
 * Sets all status fields to 'Waiting' and Pipeline_Status to 'Initialized'
 * The orchestrator (checkAndProgressPipeline) will detect this and start Stage 1
 * 
 * @param {string} tripRecordId - Airtable Record ID of the trip
 */
async function initializeEnhancementPipeline_(tripRecordId) {
  loadConfigSecrets_();
  if (!tripRecordId) {
    log('initializeEnhancementPipeline_: missing tripRecordId');
    return;
  }
  
  log('🚀 Initializing enhancement pipeline for Trip ' + tripRecordId);
  
  const fields = {
    // All stages start as 'Waiting'
    AI_Status: 'Waiting',
    AI_AddOns_Status: 'Waiting',
    AI_Highlights_Status: 'Waiting',
    AI_Itinerary_Status: 'Waiting',
    AI_IncExc_Status: 'Waiting',
    AI_TripFacts_Status: 'Waiting',
    AI_FAQs_Status: 'Waiting',
    AI_Images_Status: 'Waiting',
    
    // Pipeline tracking
    Pipeline_Status: 'Initialized',  // ← Orchestrator will detect this
    Publish_Status: 'Not Started'     // ← Will be set to 'Waiting' when pipeline completes
  };
  
  try {
    const tripRes = await airtableGet_('Trips', {
      maxRecords: 1,
      filterByFormula: `RECORD_ID() = '${String(tripRecordId).replace(/'/g, "\\'")}'`
    })
    const tripRec = tripRes && tripRes.records && tripRes.records.length ? tripRes.records[0] : null
    const tripFields = tripRec && tripRec.fields ? tripRec.fields : {}
    const tripPublicId = tripFields.TripID || ''

    // 1. Update Trips table
    await airtableUpdate_('Trips', tripRecordId, fields)
    
    // 2. Create/Update Improvement Record with SEO in 'Waiting' state
    // The orchestrator will activate it by setting AI_SEO_Status = 'Pending'
    const imp = await ImprovementRepository.getOrCreateActive({
      tripRecordId: tripRecordId,
      tripFields,
      tripPublicId,
      tripName: tripFields.Title || '',
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip',
      initialFields: { AI_SEO_Status: 'Waiting' }
    });
    if (imp && imp.id) {
      await airtableUpdate_('Improvement With AI', imp.id, { AI_SEO_Status: 'Waiting' })
      log('✅ Ensured Improvement record with SEO = Waiting');
    } else {
      log('⚠️ Could not ensure Improvement record for Trip ' + tripRecordId);
    }
    
    log('✅ Pipeline initialized. Status: Initialized (waiting for orchestrator)');
  } catch (e) {
    log('❌ Error initializing pipeline: ' + e.message);
  }
}

/**
 * Check pipeline progress and move stages from Waiting → Pending
 * Run this on a 5-minute time-driven trigger
 * 
 * This function checks all trips with active pipelines and progresses
 * them through the stages sequentially.
 */
async function checkAndProgressPipeline() {
  loadConfigSecrets_();
  const l = lock
  if (!(await l.tryLock(20000))) {
    log('checkAndProgressPipeline: lock busy, skipping');
    return;
  }

  try {
    log('🔍 Checking pipeline progress...');
    
    try {
      // Find trips with active pipelines
      const formula = "OR({Pipeline_Status} = 'Initialized', {Pipeline_Status} = 'In Progress')";
      const params = {
        filterByFormula: formula,
        pageSize: 100
      };
      
      const res = await airtableGet_('Trips', params)
      const trips = res && res.records ? res.records : []
      
      if (!trips.length) {
        log('No active pipelines found');
        return;
      }
      
      log('Found ' + trips.length + ' trip(s) with active pipelines');
      
      for (let i = 0; i < trips.length; i++) {
        const trip = trips[i]
        const tripId = trip.id
        const f = trip.fields
        try {
          await progressTripPipeline_(tripId, f)
        } catch (e) {
          log('❌ Error progressing pipeline for Trip ' + tripId + ': ' + e.message);
        }
      }
      
    } catch (e) {
      log('❌ Fatal error in checkAndProgressPipeline: ' + e.message);
    }
    
    log('✅ Pipeline check complete');
  } finally {
    l.releaseLock()
  }
}

/**
 * Progress a single trip through the pipeline stages
 * @param {string} tripId - Trip Record ID
 * @param {Object} f - Trip fields
 */
async function progressTripPipeline_(tripId, f) {
  let updated = false
  
  // 🆕 SPECIAL CASE: Detect newly initialized pipelines
  // When Pipeline_Status = 'Initialized', reset and activate Stage 1 (SEO)
  if (f.Pipeline_Status === 'Initialized') {
    log('🚀 Trip ' + tripId + ': Initializing Pipeline (Reset & Start)...');
    
    const imp = await ImprovementRepository.getOrCreateActive({
      tripRecordId: tripId,
      tripFields: f,
      tripPublicId: f.TripID || '',
      tripName: f.Title || '',
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip',
      initialFields: { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' }
    });

    if (imp && imp.id) {
      await airtableUpdate_('Improvement With AI', imp.id, { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' })
      log('✅ Ensured Improvement record with SEO = Pending');
      await airtableUpdate_('Trips', tripId, { Pipeline_Status: 'In Progress' })
      log('✅ Trip ' + tripId + ': Pipeline moved to In Progress');
    } else {
      log('❌ Failed to ensure Improvement record for Trip ' + tripId);
    }
    
    return; // Exit - next iteration will progress normally
  }
  
  // Fetch Improvement Record to check SEO Status (Stage 1)
  const tripNumber = f && f.TripID ? f.TripID : ''
  const tripName = f && f.Title ? f.Title : ''
  const improvementRec = await findImprovementRecordForTrip_(tripId, tripNumber, tripName)
  const seoStatus = improvementRec ? (improvementRec.fields.AI_SEO_Status || 'Pending') : 'Pending'
  
  // Stage 1 (SEO) → Stage 2 (Content)
  // Accept 'Waiting' OR 'Processing' (since SEO enhancer sets it to Processing)
  if (seoStatus === 'Done' && (f.AI_Status === 'Waiting' || f.AI_Status === 'Processing')) {
    await updateEnhancementStatus_(tripId, 'AI_Status', 'Pending')
    
    // Also update AI_Status in Improvement table to Pending (Critical for ai_enhancer.gs)
    if (improvementRec) {
      await airtableUpdate_('Improvement With AI', improvementRec.id, { AI_Status: 'Pending' })
    }
    
    await airtableUpdate_('Trips', tripId, { Pipeline_Status: 'In Progress' })
    log('📍 Trip ' + tripId + ': Stage 1 (SEO) → Stage 2 (Content)');
    updated = true;
  }
  
  // Stage 2 (Content) → Stage 3 (AddOns)
  if (f.AI_Status === 'Done' && f.AI_AddOns_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_AddOns_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 2 (Content) → Stage 3 (AddOns)');
    updated = true;
  }
  
  // Stage 3 → Stage 4 (Highlights)
  if (f.AI_AddOns_Status === 'Done' && f.AI_Highlights_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_Highlights_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 3 (AddOns) → Stage 4 (Highlights)');
    updated = true;
  }
  
  // Stage 4 → Stage 5 (Itinerary)
  if (f.AI_Highlights_Status === 'Done' && f.AI_Itinerary_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_Itinerary_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 4 (Highlights) → Stage 5 (Itinerary)');
    updated = true;
  }
  
  // Stage 5 → Stage 6 (Inc/Exc)
  if (f.AI_Itinerary_Status === 'Done' && f.AI_IncExc_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_IncExc_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 5 (Itinerary) → Stage 6 (Inc/Exc)');
    updated = true;
  }
  
  // Stage 6 → Stage 7 (Trip Facts)
  if (f.AI_IncExc_Status === 'Done' && f.AI_TripFacts_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_TripFacts_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 6 (Inc/Exc) → Stage 7 (Trip Facts)');
    updated = true;
  }
  
  // Stage 7 → Stage 8 (FAQs)
  if (f.AI_TripFacts_Status === 'Done' && f.AI_FAQs_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_FAQs_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 7 (Trip Facts) → Stage 8 (FAQs)');
    updated = true;
  }
  
  // Stage 8 → Stage 9 (Images)
  if (f.AI_FAQs_Status === 'Done' && f.AI_Images_Status === 'Waiting') {
    await updateEnhancementStatus_(tripId, 'AI_Images_Status', 'Pending')
    log('📍 Trip ' + tripId + ': Stage 8 (FAQs) → Stage 9 (Images)');
    updated = true;
  }

  
  // Check for completion - Verify ALL stages are Done
  var allStagesDone = 
    seoStatus === 'Done' &&
    f.AI_Status === 'Done' &&
    f.AI_AddOns_Status === 'Done' &&
    f.AI_Highlights_Status === 'Done' &&
    f.AI_Itinerary_Status === 'Done' &&
    f.AI_IncExc_Status === 'Done' &&
    f.AI_TripFacts_Status === 'Done' &&
    f.AI_FAQs_Status === 'Done' &&
    f.AI_Images_Status === 'Done';

  if (allStagesDone) {
    await airtableUpdate_('Trips', tripId, {
      Pipeline_Status: 'Completed',
      Publish_Status: 'Pending'
    });
    log('🎉 Pipeline COMPLETED for Trip ' + tripId + ' - Ready for publishing');
    updated = true;
  }
  
  if (!updated) {
    // No progression - check if stuck
    var allStatuses = [
      f.AI_Status, f.AI_AddOns_Status, f.AI_Highlights_Status,
      f.AI_Itinerary_Status, f.AI_IncExc_Status, f.AI_TripFacts_Status,
      f.AI_FAQs_Status, f.AI_SEO_Status, f.AI_Images_Status
    ];
    
    var hasProcessing = allStatuses.indexOf('Processing') !== -1;
    var hasPending = allStatuses.indexOf('Pending') !== -1;
    
    if (!hasProcessing && !hasPending) {
      log('⚠️ Trip ' + tripId + ': Pipeline may be stuck (no Processing or Pending stages)');
    }
  }
}

/**
 * Detect and fix stuck processes
 * Run this on a 30-minute time-driven trigger
 * 
 * A process is considered "stuck" if it has been in "Processing" state.
 * This function simply logs stuck processes for manual review.
 * To auto-fix, you can uncomment the status update line.
 */
async function detectStuckProcesses() {
  log('🔍 Detecting stuck processes...');
  
  var statusFields = [
    'AI_Status', 'AI_AddOns_Status', 'AI_Highlights_Status',
    'AI_Itinerary_Status', 'AI_IncExc_Status', 'AI_TripFacts_Status',
    'AI_FAQs_Status', 'AI_SEO_Status', 'AI_Images_Status'
  ];
  
  try {
    const formula = "OR({Pipeline_Status} = 'Initialized', {Pipeline_Status} = 'In Progress')"
    const res = await airtableGet_('Trips', { filterByFormula: formula, pageSize: 100 })
    const trips = res && res.records ? res.records : []
    
    if (!trips.length) {
      log('No active pipelines to check');
      return;
    }
    
    let stuckCount = 0
    
    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i]
      const tripId = trip.id
      const f = trip.fields
      for (let j = 0; j < statusFields.length; j++) {
        const statusField = statusFields[j]
        if (f[statusField] === 'Processing') {
          log('⚠️ STUCK PROCESS DETECTED: Trip ' + tripId + ', Field: ' + statusField)
          log('   Status has been "Processing" - may need manual review')
          stuckCount++
        }
      }
    }
    
    if (stuckCount > 0) {
      log('⚠️ Found ' + stuckCount + ' stuck process(es) - review logs for details');
    } else {
      log('✅ No stuck processes found');
    }
    
  } catch (e) {
    log('❌ Error in detectStuckProcesses: ' + e.message);
  }
}

/**
 * Create time-driven triggers for the orchestrator
 * Run this once to set up the triggers
 */
async function createOrchestratorTriggers() {
  log('Orchestrator: createOrchestratorTriggers is not supported in Node runtime')
}

/**
 * Find Improvement With AI record for a trip
 * @param {string} tripId - Trip Record ID
 * @return {Object|null} - Improvement record or null
 */
async function findImprovementRecordForTrip_(tripId, tripNumber, tripName) {
  if (!tripId) return null;
  
  try {
    const rec = await ImprovementRepository.fetchImprovementRecordForTrip({
      tripRecordId: tripId,
      tripPublicId: tripNumber || '',
      tripName: tripName || '',
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip'
    });
    if (rec && rec.id) {
      log('✅ Found Improvement record for Trip ' + tripId);
      return rec;
    }
    log('❌ No Improvement record found for Trip ' + tripId);
    return null;
  } catch (e) {
    log('Error finding Improvement record: ' + e.message);
    return null;
  }
}

function createOrchestrator(options) {
  let inited = false
  async function ensureInit() {
    if (inited) return
    initOrchestrator(options)
    inited = true
  }

  return {
    initializeEnhancementPipeline_: async (...args) => {
      await ensureInit()
      return initializeEnhancementPipeline_(...args)
    },
    checkAndProgressPipeline: async (...args) => {
      await ensureInit()
      return checkAndProgressPipeline(...args)
    },
    detectStuckProcesses: async (...args) => {
      await ensureInit()
      return detectStuckProcesses(...args)
    },
    createOrchestratorTriggers: async (...args) => {
      await ensureInit()
      return createOrchestratorTriggers(...args)
    }
  }
}

module.exports = { createOrchestrator }

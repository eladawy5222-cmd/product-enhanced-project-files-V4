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
function initializeEnhancementPipeline_(tripRecordId) {
  loadConfigSecrets_();
  if (!tripRecordId) {
    Logger.log('initializeEnhancementPipeline_: missing tripRecordId');
    return;
  }
  
  Logger.log('🚀 Initializing enhancement pipeline for Trip ' + tripRecordId);
  
  var fields = {
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
    // 1. Update Trips table
    airtableUpdate_('Trips', tripRecordId, fields);
    
    // 2. Create/Update Improvement Record with SEO in 'Waiting' state
    // The orchestrator will activate it by setting AI_SEO_Status = 'Pending'
    var imp = ImprovementRepository.getOrCreateActive({
      tripRecordId: tripRecordId,
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip',
      initialFields: { AI_SEO_Status: 'Waiting' }
    });
    if (imp && imp.id) {
      airtableUpdate_('Improvement With AI', imp.id, { AI_SEO_Status: 'Waiting' });
      Logger.log('✅ Ensured Improvement record with SEO = Waiting');
    } else {
      Logger.log('⚠️ Could not ensure Improvement record for Trip ' + tripRecordId);
    }
    
    Logger.log('✅ Pipeline initialized. Status: Initialized (waiting for orchestrator)');
  } catch (e) {
    Logger.log('❌ Error initializing pipeline: ' + e.message);
  }
}

/**
 * Check pipeline progress and move stages from Waiting → Pending
 * Run this on a 5-minute time-driven trigger
 * 
 * This function checks all trips with active pipelines and progresses
 * them through the stages sequentially.
 */
function checkAndProgressPipeline() {
  loadConfigSecrets_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('checkAndProgressPipeline: lock busy, skipping');
    return;
  }

  try {
    Logger.log('🔍 Checking pipeline progress...');
    
    try {
      // Find trips with active pipelines
      var formula = "OR({Pipeline_Status} = 'Initialized', {Pipeline_Status} = 'In Progress')";
      var params = {
        filterByFormula: formula,
        pageSize: 100
      };
      
      var res = airtableGet_('Trips', params);
      var trips = res && res.records ? res.records : [];
      
      if (!trips.length) {
        Logger.log('No active pipelines found');
        return;
      }
      
      Logger.log('Found ' + trips.length + ' trip(s) with active pipelines');
      
      trips.forEach(function(trip) {
        var tripId = trip.id;
        var f = trip.fields;
        
        try {
          progressTripPipeline_(tripId, f);
        } catch (e) {
          Logger.log('❌ Error progressing pipeline for Trip ' + tripId + ': ' + e.message);
        }
      });
      
    } catch (e) {
      Logger.log('❌ Fatal error in checkAndProgressPipeline: ' + e.message);
    }
    
    Logger.log('✅ Pipeline check complete');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Progress a single trip through the pipeline stages
 * @param {string} tripId - Trip Record ID
 * @param {Object} f - Trip fields
 */
function progressTripPipeline_(tripId, f) {
  var updated = false;
  
  // 🆕 SPECIAL CASE: Detect newly initialized pipelines
  // When Pipeline_Status = 'Initialized', reset and activate Stage 1 (SEO)
  if (f.Pipeline_Status === 'Initialized') {
    Logger.log('🚀 Trip ' + tripId + ': Initializing Pipeline (Reset & Start)...');
    
    var imp = ImprovementRepository.getOrCreateActive({
      tripRecordId: tripId,
      tripFields: f,
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip',
      initialFields: { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' }
    });

    if (imp && imp.id) {
      airtableUpdate_('Improvement With AI', imp.id, { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' });
      Logger.log('✅ Ensured Improvement record with SEO = Pending');
      airtableUpdate_('Trips', tripId, { Pipeline_Status: 'In Progress' });
      Logger.log('✅ Trip ' + tripId + ': Pipeline moved to In Progress');
    } else {
      Logger.log('❌ Failed to ensure Improvement record for Trip ' + tripId);
    }
    
    return; // Exit - next iteration will progress normally
  }
  
  // Fetch Improvement Record to check SEO Status (Stage 1)
  var improvementRec = findImprovementRecordForTrip_(tripId);
  var seoStatus = improvementRec ? (improvementRec.fields.AI_SEO_Status || 'Pending') : 'Pending';
  
  // Stage 1 (SEO) → Stage 2 (Content)
  // Accept 'Waiting' OR 'Processing' (since SEO enhancer sets it to Processing)
  if (seoStatus === 'Done' && (f.AI_Status === 'Waiting' || f.AI_Status === 'Processing')) {
    updateEnhancementStatus_(tripId, 'AI_Status', 'Pending');
    
    // Also update AI_Status in Improvement table to Pending (Critical for ai_enhancer.gs)
    if (improvementRec) {
      airtableUpdate_('Improvement With AI', improvementRec.id, { AI_Status: 'Pending' });
    }
    
    airtableUpdate_('Trips', tripId, { Pipeline_Status: 'In Progress' });
    Logger.log('📍 Trip ' + tripId + ': Stage 1 (SEO) → Stage 2 (Content)');
    updated = true;
  }
  
  // Stage 2 (Content) → Stage 3 (AddOns)
  if (f.AI_Status === 'Done' && f.AI_AddOns_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_AddOns_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 2 (Content) → Stage 3 (AddOns)');
    updated = true;
  }
  
  // Stage 3 → Stage 4 (Highlights)
  if (f.AI_AddOns_Status === 'Done' && f.AI_Highlights_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_Highlights_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 3 (AddOns) → Stage 4 (Highlights)');
    updated = true;
  }
  
  // Stage 4 → Stage 5 (Itinerary)
  if (f.AI_Highlights_Status === 'Done' && f.AI_Itinerary_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_Itinerary_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 4 (Highlights) → Stage 5 (Itinerary)');
    updated = true;
  }
  
  // Stage 5 → Stage 6 (Inc/Exc)
  if (f.AI_Itinerary_Status === 'Done' && f.AI_IncExc_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_IncExc_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 5 (Itinerary) → Stage 6 (Inc/Exc)');
    updated = true;
  }
  
  // Stage 6 → Stage 7 (Trip Facts)
  if (f.AI_IncExc_Status === 'Done' && f.AI_TripFacts_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_TripFacts_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 6 (Inc/Exc) → Stage 7 (Trip Facts)');
    updated = true;
  }
  
  // Stage 7 → Stage 8 (FAQs)
  if (f.AI_TripFacts_Status === 'Done' && f.AI_FAQs_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_FAQs_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 7 (Trip Facts) → Stage 8 (FAQs)');
    updated = true;
  }
  
  // Stage 8 → Stage 9 (Images)
  if (f.AI_FAQs_Status === 'Done' && f.AI_Images_Status === 'Waiting') {
    updateEnhancementStatus_(tripId, 'AI_Images_Status', 'Pending');
    Logger.log('📍 Trip ' + tripId + ': Stage 8 (FAQs) → Stage 9 (Images)');
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
    airtableUpdate_('Trips', tripId, {
      Pipeline_Status: 'Completed',
      Publish_Status: 'Pending'
    });
    Logger.log('🎉 Pipeline COMPLETED for Trip ' + tripId + ' - Ready for publishing');
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
      Logger.log('⚠️ Trip ' + tripId + ': Pipeline may be stuck (no Processing or Pending stages)');
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
function detectStuckProcesses() {
  Logger.log('🔍 Detecting stuck processes...');
  
  var statusFields = [
    'AI_Status', 'AI_AddOns_Status', 'AI_Highlights_Status',
    'AI_Itinerary_Status', 'AI_IncExc_Status', 'AI_TripFacts_Status',
    'AI_FAQs_Status', 'AI_SEO_Status', 'AI_Images_Status'
  ];
  
  try {
    var formula = "OR({Pipeline_Status} = 'Initialized', {Pipeline_Status} = 'In Progress')";
    var res = airtableGet_('Trips', { filterByFormula: formula, pageSize: 100 });
    var trips = res && res.records ? res.records : [];
    
    if (!trips.length) {
      Logger.log('No active pipelines to check');
      return;
    }
    
    var stuckCount = 0;
    
    trips.forEach(function(trip) {
      var tripId = trip.id;
      var f = trip.fields;
      
      statusFields.forEach(function(statusField) {
        if (f[statusField] === 'Processing') {
          Logger.log('⚠️ STUCK PROCESS DETECTED: Trip ' + tripId + ', Field: ' + statusField);
          Logger.log('   Status has been "Processing" - may need manual review');
          
          // Optional: Auto-reset to Error (uncomment to enable)
          // updateEnhancementStatus_(tripId, statusField, 'Error');
          
          stuckCount++;
        }
      });
    });
    
    if (stuckCount > 0) {
      Logger.log('⚠️ Found ' + stuckCount + ' stuck process(es) - review logs for details');
    } else {
      Logger.log('✅ No stuck processes found');
    }
    
  } catch (e) {
    Logger.log('❌ Error in detectStuckProcesses: ' + e.message);
  }
}

/**
 * Create time-driven triggers for the orchestrator
 * Run this once to set up the triggers
 */
function createOrchestratorTriggers() {
  // Delete existing triggers first
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    var funcName = trigger.getHandlerFunction();
    if (funcName === 'checkAndProgressPipeline' || funcName === 'detectStuckProcesses') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger: ' + funcName);
    }
  });
  
  // Create new triggers
  ScriptApp.newTrigger('checkAndProgressPipeline')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('✅ Created trigger: checkAndProgressPipeline (every 5 minutes)');
  
  ScriptApp.newTrigger('detectStuckProcesses')
    .timeBased()
    .everyMinutes(30)
    .create();
  Logger.log('✅ Created trigger: detectStuckProcesses (every 30 minutes)');
}

/**
 * Find Improvement With AI record for a trip
 * @param {string} tripId - Trip Record ID
 * @return {Object|null} - Improvement record or null
 */
function findImprovementRecordForTrip_(tripId) {
  if (!tripId) return null;
  
  try {
    var rec = ImprovementRepository.fetchImprovementRecordForTrip({
      tripRecordId: tripId,
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip'
    });
    if (rec && rec.id) {
      Logger.log('✅ Found Improvement record for Trip ' + tripId);
      return rec;
    }
    Logger.log('❌ No Improvement record found for Trip ' + tripId);
    return null;
  } catch (e) {
    Logger.log('Error finding Improvement record: ' + e.message);
    return null;
  }
}

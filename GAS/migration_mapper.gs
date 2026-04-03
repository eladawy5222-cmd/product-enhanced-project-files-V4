/************************************************************
 * MIGRATION MAPPER
 * Transform data from old Airtable format to new format
 ************************************************************/

/**
 * Generate next TripID in format 99xxxxx
 */
function generateTripID_() {
  var props = PropertiesService.getScriptProperties();
  var lastId = props.getProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY);
  
  var nextId;
  if (!lastId) {
    // First time - start from configured start value
    nextId = MIGRATION_CONFIG.TRIP_ID_START;
  } else {
    nextId = parseInt(lastId, 10) + 1;
  }
  
  // Save for next time
  props.setProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY, String(nextId));
  
  if (MIGRATION_CONFIG.DEBUG) {
    Logger.log('Generated TripID: ' + nextId);
  }
  
  return String(nextId);
}

/**
 * Reset TripID counter (for testing)
 */
function resetTripIDCounter_() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY);
  Logger.log('TripID counter reset. Next ID will be: ' + MIGRATION_CONFIG.TRIP_ID_START);
}

/**
 * Get current TripID counter value
 */
function getCurrentTripID_() {
  var props = PropertiesService.getScriptProperties();
  var lastId = props.getProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY);
  return lastId ? parseInt(lastId, 10) : null;
}

/**
 * Map old trip record to new Trips table fields
 */
function mapOldTripToNew_(oldRecord) {
  var fields = oldRecord.fields || {};
  var newFields = {};
  
  // Generate unique TripID
  var tripId = generateTripID_();
  newFields.TripID = tripId;
  
  // Map basic fields
  var fieldMap = MIGRATION_CONFIG.FIELD_MAP.TRIPS;
  for (var oldField in fieldMap) {
    if (fieldMap.hasOwnProperty(oldField)) {
      var newField = fieldMap[oldField];
      var value = fields[oldField] || '';
      
      // Special handling for specific fields
      if (oldField === 'Duration') {
        // Try to extract number from duration text
        newFields[newField] = parseDuration_(value);
      } else if (oldField === 'Price') {
        // Try to extract number from price text
        newFields[newField] = parsePrice_(value);
      } else {
        newFields[newField] = value;
      }
    }
  }
  
  // Combine Overview and Full description
  var overview = fields['Overview'] || '';
  var fullDesc = fields['Full description'] || '';
  if (overview && fullDesc && overview !== fullDesc) {
    newFields.Trip_Description = overview + '\n\n' + fullDesc;
  } else {
    newFields.Trip_Description = overview || fullDesc || '';
  }
  
  // 🆕 ENHANCEMENTS FOR MIGRATED TRIPS
  
  // 1. StatusWorkflow = 'publish'
  newFields.StatusWorkflow = 'publish';
  
  // 2. Slug - generate from Title
  if (newFields.Title) {
    newFields.Slug = generateSlugFromTitle_(newFields.Title);
  }
  
  // 3. TripCode = FTS-{TripID}
  newFields.TripCode = 'FTS-' + tripId;
  
  // 4. Duration_Unit - infer from Duration_Hours
  if (newFields.Duration_Hours) {
    newFields.Duration_Unit = inferDurationUnit_(newFields.Duration_Hours);
  }
  
  // Set migration metadata
  newFields.LastSynced = new Date().toISOString();
  
  return {
    tripId: tripId,
    fields: newFields
  };
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlugFromTitle_(title) {
  if (!title) return '';
  
  return String(title)
    .toLowerCase()
    .trim()
    // Replace spaces and special chars with hyphens
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Infer duration unit from hours value
 */
function inferDurationUnit_(hours) {
  if (!hours) return 'hours';
  
  var h = parseFloat(hours);
  if (isNaN(h)) return 'hours';
  
  // If >= 24 hours, use days
  if (h >= 24) {
    return 'days';
  }
  // If < 1 hour, use minutes
  else if (h < 1) {
    return 'minutes';
  }
  // Otherwise hours
  else {
    return 'hours';
  }
}

/**
 * Parse duration from text (e.g., "Full day tour" -> extract hours if possible)
 */
function parseDuration_(text) {
  if (!text) return '';
  
  // Try to find numbers followed by "hour" or "day"
  var hourMatch = text.match(/(\d+)\s*(hour|hr)/i);
  if (hourMatch) {
    return hourMatch[1];
  }
  
  var dayMatch = text.match(/(\d+)\s*day/i);
  if (dayMatch) {
    // Convert days to hours (assuming 8-hour days)
    return String(parseInt(dayMatch[1], 10) * 8);
  }
  
  // If can't parse, return original text
  return text;
}

/**
 * Parse price from text (e.g., "$50" -> "50")
 */
function parsePrice_(text) {
  if (!text) return '';
  
  // Remove currency symbols and extract number
  var match = text.match(/[\d,]+\.?\d*/);
  if (match) {
    return match[0].replace(/,/g, '');
  }
  
  return text;
}

/**
 * Extract highlights from text and create array of records
 */
function extractHighlightsFromOld_(text, tripId) {
  if (!text) return [];
  
  var pattern = MIGRATION_CONFIG.SPLIT_PATTERNS.HIGHLIGHTS;
  var lines = text.split(pattern)
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.length > 0; });
  
  var records = [];
  for (var i = 0; i < lines.length; i++) {
    records.push({
      TripID: tripId,
      Highlight: lines[i],
      Order: i + 1
    });
  }
  
  return records;
}

/**
 * Extract itinerary steps from text
 */
function extractItineraryFromOld_(text, tripId) {
  if (!text) return [];
  
  var pattern = MIGRATION_CONFIG.SPLIT_PATTERNS.ITINERARY;
  var sections = text.split(pattern)
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 0; });
  
  var records = [];
  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    
    // Try to extract day number from text
    var dayMatch = section.match(/Day\s*(\d+)/i);
    var stepTitle = dayMatch ? 'Day ' + dayMatch[1] : 'Step ' + (i + 1);
    
    records.push({
      TripID: tripId,
      StepOrder: i + 1,
      StepTitle: stepTitle,
      StepDescription: section
    });
  }
  
  return records;
}

/**
 * Extract includes from text
 */
function extractIncludesFromOld_(text, tripId) {
  if (!text) return [];
  
  var pattern = MIGRATION_CONFIG.SPLIT_PATTERNS.INCLUDES;
  var items = text.split(pattern)
    .map(function(item) { return item.trim(); })
    .filter(function(item) { return item.length > 0; });
  
  var records = [];
  for (var i = 0; i < items.length; i++) {
    records.push({
      TripID: tripId,
      IncludeItem: items[i]
    });
  }
  
  return records;
}

/**
 * Extract excludes from text
 */
function extractExcludesFromOld_(text, tripId) {
  if (!text) return [];
  
  var pattern = MIGRATION_CONFIG.SPLIT_PATTERNS.EXCLUDES;
  var items = text.split(pattern)
    .map(function(item) { return item.trim(); })
    .filter(function(item) { return item.length > 0; });
  
  var records = [];
  for (var i = 0; i < items.length; i++) {
    records.push({
      TripID: tripId,
      ExcludeItem: items[i]
    });
  }
  
  return records;
}

/**
 * Extract packages from Option 1-10 and Price 1-10 fields
 */
function extractPackagesFromOld_(oldRecord, tripId) {
  var fields = oldRecord.fields || {};
  var packages = [];
  
  var config = MIGRATION_CONFIG.FIELD_MAP.PACKAGES;
  var maxOptions = config.maxOptions;
  
  for (var i = 1; i <= maxOptions; i++) {
    var optionField = config.optionPrefix + i;
    var priceField = config.pricePrefix + i;
    
    var optionText = fields[optionField];
    var priceText = fields[priceField];
    
    // Only create package if option has content
    if (optionText && optionText.trim()) {
      var packageRecord = {
        TripID: tripId,
        PackageTitle: optionText.trim(),
        PackageID: tripId + '-PKG' + i
      };
      
      // Parse price if available
      if (priceText) {
        var price = parsePrice_(priceText);
        if (price) {
          packageRecord.SalePrice = price;
          packageRecord.Currency = 'USD'; // Default, adjust if needed
        }
      }
      
      packages.push(packageRecord);
    }
  }
  
  return packages;
}

/**
 * Clean and normalize text
 */
function cleanText_(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .trim();
}
